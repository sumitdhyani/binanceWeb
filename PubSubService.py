import asyncio, re, aiokafka, traceback
from asyncio.log import logger
import json
from CommunicationLayer import startCommunication, produce, pause, resume
from aiokafka.structs import TopicPartition
pubSubSyncdata = "pubSub_sync_data"
pubSubSyncdataRequests = "pubSub_sync_data_requests"

def generateTopicPartitionGroupId(serviceGroup, topic, partition):
    return serviceGroup + topic + str(partition)

async def onRebalance(oldRevoked,
                      newAssigned,
                      serviceGroup,
                      partitionToSubscriptionKeys,
                      appUnsubMethod,
                      syncQueueId,
                      logger):
    await asyncio.gather(*[onPartitionRevoked(partition, 
                                              partitionToSubscriptionKeys,
                                              appUnsubMethod,
                                              logger
                                              ) for topic, partition in oldRevoked])
    await asyncio.gather(*[onNewPartitionAssigned(topic,
                                                  partition,
                                                  serviceGroup,
                                                  syncQueueId,
                                                  logger) for topic, partition in newAssigned])

async def onNewPartitionAssigned(topic,
                                 partition,
                                 serviceGroup,
                                 syncQueueId,
                                 logger):
    logger.info("New assigned topic: %s, partition: %s", topic, str(partition))
    group = generateTopicPartitionGroupId(serviceGroup, topic, partition)
    syncMsgsDict = {"group" : group, "destination_topic" : syncQueueId}
    await produce(pubSubSyncdataRequests, json.dumps(syncMsgsDict), group)

async def onSyncData(message, appSubFunc):
    msgDict = json.loads(message)
    if msgDict:
        for key in msgDict.keys():
            for destTopic in msgDict[key]:
                params = re.split(",", key.replace(",)", ")").strip("[]()").replace("'", '')) + [destTopic]
                await appSubFunc(*params)
    else:
        logger.info("Resuming topic: %s, partition: %s", pausedTopic, str(pausedPartition))
    
    
async def onPartitionRevoked(partition,
                             partitionToSubscriptionKeys,
                             appUnsubMethod,
                             logger):
    logger.info("Revoked partition: %s", str(partition))
    try:
        for subscriptionKey in partitionToSubscriptionKeys[partition]:
            logger.info("Partition %s revoked, key: %s for this partition will be dropped", str(partition), subscriptionKey)
            await appUnsubMethod(*subscriptionKey)
        partitionToSubscriptionKeys.pop(partition)
    except KeyError:
        logger.warning("Partition %s revoked, but there were no active subscriptions for this partition", str(partition))
    except Exception as ex:
        logger.warning("Unexpected error while rebalancing, details: %s", str(ex))
        
def updatePartitionBook(partition,
                        subscriptionParams,
                        partitionToSubscriptionKeys):
    if partition not in partitionToSubscriptionKeys.keys():
        partitionToSubscriptionKeys[partition] = set()
    partitionToSubscriptionKeys[partition].add(subscriptionParams)

async def sendSycInfo(topic,
                      partition,
                      msgKey,
                      subscriptionParams,
                      serviceGroup,
                      action,
                      destTopic,
                      logger):
    logger.info("Sending sync msg for: %s", msgKey)
    syncMsgDict = {"key" : subscriptionParams,
                   "group" : generateTopicPartitionGroupId(serviceGroup, topic, partition),
                   "action" : action,
                   "destination_topic" : destTopic}
    await produce(pubSubSyncdata, json.dumps(syncMsgDict), msgKey)

async def onSubMsg(topic,
                   partition,
                   msgKey,
                   msg,
                   appCallback,
                   serviceGroup,
                   partitionToSubscriptionKeys,
                   logger):
    msgDict = json.loads(msg)
    subscriptionParams = None
    try:
        subscriptionParams = await appCallback(msgDict)
    except Exception as ex:
        logger.error("Exceptin in Application code: %s", str(ex))
        
    logger.debug("subscriptionKey: %s", msgKey)
    
    #Subscription key is expected to be a tuple of values required to identify the
    #subscribed entity, this tuple of values will later be used to unsubscribe that entity
    if subscriptionParams is not None:
        updatePartitionBook(partition,
                            subscriptionParams,
                            partitionToSubscriptionKeys)
        
        await sendSycInfo(topic,
                          partition,
                          msgKey,
                          subscriptionParams,
                          serviceGroup,
                          msgDict["action"],
                          msgDict["destination_topic"],
                          logger)
    
async def start(brokers,
                reqTopic,
                appCallback,
                serviceGroup,
                serviceId,
                appSubMethod,
                appUnsubMethod,
                logger,
                isInternalService):
    partitionToSubscriptionKeys = {}
    async def mainCallback(topic, partition, key, msg):
        await onSubMsg(topic,
                       partition,
                       key,
                       msg,
                       appCallback,
                       serviceGroup,
                       partitionToSubscriptionKeys,
                       logger)

    syncTopic = serviceId + "_syncIn"
    async def rebalanceCallback(oldRevoked,newAssigned):
        await onRebalance(oldRevoked, 
                          newAssigned,
                          serviceGroup,
                          partitionToSubscriptionKeys,
                          appUnsubMethod,
                          syncTopic,
                          logger)
    await startCommunication({reqTopic : mainCallback},
                             {syncTopic : lambda topic, partition, key, msg : onSyncData(msg, appSubMethod) },
                             brokers,
                             serviceId,
                             serviceGroup,
                             logger,
                             True,
                             [syncTopic, serviceId] if isInternalService else [syncTopic],
                             [[reqTopic], rebalanceCallback])