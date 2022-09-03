import os, sys, inspect, asyncio, aiokafka, traceback
from tkinter.messagebox import NO
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError
from RebalanceListener import ConsumerRebalanceListener, RebalanceListener
from aiokafka.structs import TopicPartition

producer = None
admin = None
groupConsumer = None

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
    try:
        producer = aiokafka.AIOKafkaProducer(bootstrap_servers=brokers, acks="all")
        groupConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                             group_id=groupId,
                                             client_id=groupId+clientId+"_group",
                                             enable_auto_commit=False
                                            )
        
        individualConsumer = None
        if 0 < len(unCoOrdinatedtopicsAndCallbacks):
            individualConsumer = aiokafka.AIOKafkaConsumer(bootstrap_servers=brokers,
                                                           group_id=clientId,
                                                           client_id=groupId+clientId,
                                                           enable_auto_commit=False
                                                           )
            individualConsumer.subscribe([topic for topic in unCoOrdinatedtopicsAndCallbacks.keys()])
        admin = KafkaAdminClient(bootstrap_servers=brokers)
        groupConsumer.subscribe([topic for topic in coOrdinatedtopicsAndCallbacks.keys()],
                           listener= None if topicsAndrebalanceListener is None else
                           RebalanceListener(logger,
                                             set(topicsAndrebalanceListener[0]), 
                                             topicsAndrebalanceListener[1])
                           )
        
        try:
            for newTopic in topicsToCreate:
                await createTopic(newTopic, 1, 1)
        except TopicAlreadyExistsError as ex:
            logger.warn("Topic %s already exists, ignoring the attempt to create the new topic", newTopic)
       
        async def consumptionLoop(consumer, callbackDict):
            try:
                async for kafkaMsg in consumer:
                    msg = kafkaMsg.value.decode("utf-8")
                    key = kafkaMsg.key.decode("utf-8")
                    logger.debug("Msg received: %s", msg)
                    callback = callbackDict.get(kafkaMsg.topic)
                    if callback is not None:
                        try:
                            msg = kafkaMsg.value.decode("utf-8")
                            if lowLevelListener:
                                await callback(kafkaMsg.topic, kafkaMsg.partition, key, msg)
                            else:
                                await callback(msg)
                            tp = TopicPartition(kafkaMsg.topic, kafkaMsg.partition)
                            await consumer.commit({tp : kafkaMsg.offset + 1})
                        except Exception as ex:
                            logger.warn("Exception in task loop, details: %s, traceback: %s", str(ex), traceback.format_exc())
                    else:
                        logger.warn("Message received from unregistered topic: %s", kafkaMsg.topic)
            finally:
                await consumer.stop()

        await producer.start()
        await groupConsumer.start()
        consumptionLoops = [consumptionLoop(groupConsumer, coOrdinatedtopicsAndCallbacks)]
        if individualConsumer is not None:
            await individualConsumer.start()
            consumptionLoops.append(consumptionLoop(individualConsumer, unCoOrdinatedtopicsAndCallbacks))

        try:
            await asyncio.gather(*consumptionLoops)
        finally:
            await producer.stop()
            await admin.close()
            
    except Exception as ex:
        logger.error("Unexpedted exception in the main loop, details %s, traceback: %s", str(ex), traceback.format_exc())
        
async def produce(topic, data, key):
    global producer
    await producer.send_and_wait(topic,
                                 value=bytes(data, 'utf-8'),
                                 key=bytes(key, 'utf-8'))

async def createTopic(queueId, numPartitions, replicationFactor):
    global admin
    admin.create_topics([NewTopic(name=queueId, num_partitions=numPartitions, replication_factor=replicationFactor)])
    
    