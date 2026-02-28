from multiprocessing import dummy
import time
import asyncio, aiokafka, traceback, json
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
from RebalanceListener import RebalanceListener
from aiokafka.structs import TopicPartition
from CommonUtils import Timer

async def sendHeartbeat(appId):
    await produce("heartbeats", json.dumps({"evt":"HeartBeat", "appId":appId}), appId, None)

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
        logger.info("Admin client created")

        for newTopic in topicsToCreate:
            await deleteTopic(newTopic, logger)

        for newTopic in topicsToCreate:
            await createTopic(newTopic, 1, 2, logger)

        producer = aiokafka.AIOKafkaProducer(bootstrap_servers=brokers, acks="all")
        logger.info("Producer created")
        await producer.start()
        groupConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                                  group_id=groupId,
                                                  client_id=groupId+clientId+"_group")
        logger.info("Group consumer created")
        
        async def consumptionBatch(consumer, callbackDict):
            dict =  await consumer.getmany(timeout_ms=1000)
            return (dict, callbackDict, consumer)
        
        rebalanceListener = (None if topicsAndrebalanceListener is None else
                             RebalanceListener(logger,
                                               set(topicsAndrebalanceListener[0]), 
                                               topicsAndrebalanceListener[1]))

        groupConsumer.subscribe([topic for topic in coOrdinatedtopicsAndCallbacks.keys()],
                                listener=rebalanceListener)
        await groupConsumer.start()
        logger.info("Group consumer started")

        individualConsumer = None
        if unCoOrdinatedtopicsAndCallbacks:
            individualConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                                           group_id=clientId,
                                                           client_id=groupId+clientId)
            logger.info("Individual consumer created")
            individualConsumer.subscribe([topic for topic in unCoOrdinatedtopicsAndCallbacks.keys()])
            await individualConsumer.start()
            logger.info("Individual consumer started")

        timer = Timer()
        async def dummyFunc():
            await sendHeartbeat(clientId)
        await timer.setTimer(5, dummyFunc)
        await produce("registrations", json.dumps({"appId" : clientId, "appGroup" : groupId}), clientId, None)
        logger.info("Component registration sent")
        heartBeatOffsetReset = False
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
                    if topicPartition.topic == "heartbeats" and not heartBeatOffsetReset:
                        consumer.seek_to_end(topicPartition)
                        logger.info("Heartbeat offset reset to latest")
                        heartBeatOffsetReset = True
                        
                    lastCommitted = await consumer.committed(topicPartition)
                    lastCommitted = 0 if lastCommitted is None else lastCommitted
                    if lastCommitted < kafkaMsgs[0].offset:
                        logger.warn("Messages lost, tp: %s:%s no. of lost messages : %s, recovering", topicPartition.topic , str(topicPartition.partition), str(kafkaMsgs[0].offset - lastCommitted))
                        consumer.seek(topicPartition, lastCommitted)
                    else:
                        for kafkaMsg in kafkaMsgs:
                            msg = kafkaMsg.value.decode("utf-8")
                            key = kafkaMsg.key.decode("utf-8")
                            send_timestamp = kafkaMsg.timestamp 
                            headers = list(kafkaMsg.headers)
                            indexToStartWith = len(headers)
                            curr_time = int(time.time()*1000)
                            logger.debug("Msg received: %s, offset :%s, header: %s", msg, str(kafkaMsg.offset), headers)
                            headers += [(str(indexToStartWith), str(send_timestamp).encode('utf-8')), 
                                        (str(indexToStartWith+1), str(curr_time).encode('utf-8'))]

                            try:
                                callback = callbackDict.get(kafkaMsg.topic)
                                if lowLevelListener:
                                    await callback(topicPartition.topic, topicPartition.partition, key, msg, headers)
                                else:
                                    await callback(msg, headers)
                                tp = TopicPartition(kafkaMsg.topic, kafkaMsg.partition)
                            except Exception as ex:
                                logger.error("Unexpedted exception in the task loop, details %s, traceback: %s", str(ex), traceback.format_exc())
    except Exception as ex:
        logger.error("Unexpedted exception in the init phase loop, details %s, traceback: %s", str(ex), traceback.format_exc())
        if producer is not None:
            await producer.stop()

        if admin is not None:
            admin.close()

        if groupConsumer is not None:
            await groupConsumer.stop()

        if indiVidualConsumer is not None:
            await indiVidualConsumer.stop()
            
async def produce(topic, data, key, meta):
    global producer
    await producer.send_and_wait(topic,
                                 value=bytes(data, 'utf-8'),
                                 key=bytes(key, 'utf-8'),
                                 headers= [] if meta is None else meta,
                                 timestamp_ms=int(time.time()*1000))

async def createTopic(queueId, numPartitions, replicationFactor, logger):
    global admin
    try:
        admin.create_topics([NewTopic(name=queueId, num_partitions=numPartitions, replication_factor=replicationFactor)])
        logger.warn("Topic %s created the new topic", queueId)
    except TopicAlreadyExistsError as ex:
        logger.warn("Topic %s already exists, ignoring the attempt to create the new topic", queueId)

async def deleteTopic(queueId, logger):
    global admin
    try:
        admin.delete_topics([queueId])
        logger.warn("Topic %s deleted the new topic", queueId)
    except:
        logger.warn("Error while deleting topic: %s", queueId)
 

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
