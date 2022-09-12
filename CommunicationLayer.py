import os, sys, inspect, asyncio, aiokafka, traceback, json
from tkinter.messagebox import NO
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
from RebalanceListener import ConsumerRebalanceListener, RebalanceListener
from aiokafka.structs import TopicPartition
from CommonUtils import timer

async def sendHeartbeat(appId):
    await produce("heartbeats", json.dumps({"evt":"HeartBeat", "appId":appId}), appId)

producer = None
admin = None
groupConsumer = None
indiVidualConsumer = None
coOrdinatedtopicCallbackDict = None
unCoOrdinatedtopicCallbackDict = None
async def startCommunication(coOrdinatedtopicsAndCallbacks,
                             unCoOrdinatedtopicsAndCallbacks,
                             brokers,
                             clientId,
                             groupId,
                             logger,
                             lowLevelListener = False,
                             topicsToCreate = [],
                             topicsAndrebalanceListener = None):
    global producer
    global admin
    global groupConsumer
    global coOrdinatedtopicCallbackDict
    global unCoOrdinatedtopicCallbackDict
    coOrdinatedtopicCallbackDict = coOrdinatedtopicsAndCallbacks
    unCoOrdinatedtopicCallbackDict = unCoOrdinatedtopicsAndCallbacks

    try:
        admin = KafkaAdminClient(bootstrap_servers=brokers)
        try:
            for newTopic in topicsToCreate:
                await createTopic(newTopic, 1, 1)
        except TopicAlreadyExistsError as ex:
            logger.warn("Topic %s already exists, ignoring the attempt to create the new topic", newTopic)

        producer = aiokafka.AIOKafkaProducer(bootstrap_servers=brokers, acks="all")
        await producer.start()
        groupConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                                  group_id=groupId,
                                                  client_id=groupId+clientId+"_group",
                                                  enable_auto_commit=False)
        
        async def consumptionBatch(consumer, callbackDict):
            dict =  await consumer.getmany(timeout_ms=1000)
            return (dict, callbackDict, consumer)
        
        groupConsumer.subscribe([topic for topic in coOrdinatedtopicsAndCallbacks.keys()],
                                listener= None if topicsAndrebalanceListener is None else
                                RebalanceListener(logger,
                                                  set(topicsAndrebalanceListener[0]), 
                                                  topicsAndrebalanceListener[1]))
        await groupConsumer.start()

        individualConsumer = None
        if unCoOrdinatedtopicsAndCallbacks:
            individualConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                                           group_id=clientId,
                                                           client_id=groupId+clientId,
                                                           enable_auto_commit=False)
            individualConsumer.subscribe([topic for topic in unCoOrdinatedtopicsAndCallbacks.keys()])
            await individualConsumer.start()

        await timer(5, lambda : sendHeartbeat(clientId))
        while True:
            consumptionFunctions = None
            if individualConsumer is not None:
                consumptionFunctions = [consumptionBatch(groupConsumer, coOrdinatedtopicsAndCallbacks), consumptionBatch(individualConsumer, unCoOrdinatedtopicsAndCallbacks)]
            else:
                consumptionFunctions = [consumptionBatch(groupConsumer, coOrdinatedtopicsAndCallbacks)]

            for coro in asyncio.as_completed(consumptionFunctions):
                result = await coro
                messageDict = result[0]
                callbackDict = result[1]
                consumer = result[2]
                for topicPartition, kafkaMsgs in messageDict.items():
                    for kafkaMsg in kafkaMsgs:
                        msg = kafkaMsg.value.decode("utf-8")
                        key = kafkaMsg.key.decode("utf-8")
                        logger.debug("Msg received: %s", msg)
                        try:
                            callback = callbackDict.get(kafkaMsg.topic)
                            if lowLevelListener:
                                await callback(topicPartition.topic, topicPartition.partition, key, msg)
                            else:
                                await callback(msg)
                            tp = TopicPartition(kafkaMsg.topic, kafkaMsg.partition)
                            await consumer.commit({tp: kafkaMsg.offset + 1})

                        except Exception as ex:
                            logger.error("Unexpedted exception in the task loop, details %s, traceback: %s", str(ex), traceback.format_exc())
    except Exception as ex:
        logger.error("Unexpedted exception in the init phase loop, details %s, traceback: %s", str(ex), traceback.format_exc())
        await producer.stop()
        admin.close()
        await groupConsumer.stop()
        if indiVidualConsumer is not None:
            await indiVidualConsumer.stop()
            
async def produce(topic, data, key):
    global producer
    await producer.send_and_wait(topic,
                                 value=bytes(data, 'utf-8'),
                                 key=bytes(key, 'utf-8'))

async def createTopic(queueId, numPartitions, replicationFactor):
    global admin
    admin.create_topics([NewTopic(name=queueId, num_partitions=numPartitions, replication_factor=replicationFactor)])
    
def pause(topic, partition):
    if topic in coOrdinatedtopicCallbackDict.keys():
        groupConsumer.pause(TopicPartition(topic, partition))
    elif topic in unCoOrdinatedtopicCallbackDict.keys():
        indiVidualConsumer.pause(TopicPartition(topic, partition))

def resume(topic, partition):
    if topic in coOrdinatedtopicCallbackDict.keys():
        groupConsumer.resume(TopicPartition(topic, partition))
    elif topic in unCoOrdinatedtopicCallbackDict.keys():
        indiVidualConsumer.resume(TopicPartition(topic, partition))
