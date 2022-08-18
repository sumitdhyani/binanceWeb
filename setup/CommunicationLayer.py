import os, sys, inspect, aiokafka
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError

producer = None
admin = None

async def startCommunication(topicsAndCallbacks, brokers, clientId, groupId, logger, topicsToCreate = []):
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
    try:
        for newTopic in topicsToCreate:
            await createTopic(newTopic, 1, 1)
    except TopicAlreadyExistsError as ex:
        logger.warn("Topic %s already exists, ignoring the attempt to create the new topic", newTopic)
    except Exception as ex:
        logger.error("Error encountered while creating new topic: %s, error details: %s exiting the application", newTopic, str(ex))
        return

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
    
    