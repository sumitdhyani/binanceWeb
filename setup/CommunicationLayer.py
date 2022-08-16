import os, sys, inspect, asyncio, json, aiokafka
from pydoc import cli
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)

producer = None
admin = None
from kafka.admin import KafkaAdminClient, NewTopic

async def startCommunication(topicsAndCallbacks, brokers, clientId, groupId, logger):
    global producer
    global admin
    producer = aiokafka.AIOKafkaProducer(bootstrap_servers=brokers)
    callbackDict = topicsAndCallbacks
    topicList = []
    for topic in topicsAndCallbacks.keys():
        topicList.append(topic)
    consumer = aiokafka.AIOKafkaConsumer(*topicList,
                                         bootstrap_servers=brokers,
                                         group_id=groupId,
                                         client_id=clientId
                                        )
    admin = KafkaAdminClient(bootstrap_servers=brokers)
    await producer.start()
    await consumer.start()
    
    try:
        async for kafkaMsg in consumer:
            msg = kafkaMsg.value.decode("utf-8")
            topic = kafkaMsg.topic
            logger.debug("Msg received: %s", msg)
            callback = callbackDict.get(topic)
            if callback is not None:
                try:
                    await callback(msg)
                except Exception as ex:
                    logger.warn("Exception in task loop, details: %s", str(ex))
                
            else:
                logger.warn("Message received from unregistered topic: %s", topic)
    finally:
        await consumer.stop()

async def produce(topic, bytes):
    global producer
    await producer.send_and_wait(topic, bytes)

async def createTopic(queueId, numPartitions, replicationFactor):
    global admin
    admin.create_topics([NewTopic(name=queueId, num_partitions=numPartitions, replication_factor=replicationFactor)])
    
    