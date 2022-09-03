import asyncio, aiokafka, traceback
import json
from CommunicationLayer import startCommunication, produce
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
                                                  syncQueueId) for topic, partition in newAssigned])

async def onNewPartitionAssigned(topic, partition, serviceGroup, syncQueueId):
    group = generateTopicPartitionGroupId(serviceGroup, topic, partition)
    syncMsgsDict = {"group" : group, "destination_topic" : syncQueueId}
    await produce(pubSubSyncdataRequests, json.dumps(syncMsgsDict), group)

async def onPartitionRevoked(partition,
                             partitionToSubscriptionKeys,
                             appUnsubMethod,
                             logger):
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
                        subscriptionKey,
                        partitionToSubscriptionKeys):
    if partition not in partitionToSubscriptionKeys.keys():
        partitionToSubscriptionKeys[partition] = set()
    partitionToSubscriptionKeys[partition].add(subscriptionKey)

async def sendSycInfo(topic,
                      partition,
                      msgKey,
                      serviceGroup,
                      action,
                      destTopic,
                      logger
                      ):
    logger.info("Sending sync msg for: %s", msgKey)
    syncMsgDict = {"key" : msgKey,
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
    subscriptionKey = None
    try:
        subscriptionKey = await appCallback(msgDict)
    except Exception as ex:
        logger.error("Exceptin in Application code: %s", str(ex))
        
    logger.debug("subscriptionKey: %s", msgKey)
    
    #Subscription key is expected to be a tuple of values required to identify the
    #subscribed entity, this tuple of values will later be used to unsubscribe that entity
    if subscriptionKey is not None:
        updatePartitionBook(partition,
                            subscriptionKey,
                            partitionToSubscriptionKeys)
        
        await sendSycInfo(topic,
                          partition,
                          msgKey,
                          serviceGroup,
                          msgDict["action"],
                          msgDict["destination_topic"],
                          logger)
    
async def start(brokers,
                reqTopic,
                appCallback,
                serviceGroup,
                serviceId,
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
                             {},
                             brokers,
                             serviceId,
                             serviceGroup,
                             logger,
                             True,
                             [syncTopic, serviceId] if isInternalService else [syncTopic],
                             [[reqTopic], rebalanceCallback])