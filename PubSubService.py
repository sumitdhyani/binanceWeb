import asyncio, re, aiokafka, traceback
from asyncio.log import logger
import json
from CommunicationLayer import startCommunication, produce, pause, resume
from aiokafka.structs import TopicPartition
pubSubSyncdata = "pubSub_sync_data"
pubSubSyncdataRequests = "pubSub_sync_data_requests"
from PubSubTPStateMachine import PubSubTPStateMachine

tpBook = {}

def generateTopicPartitionGroupId(serviceGroup, topic, partition):
    return serviceGroup + ":" + topic + ":" + str(partition)

def generateComponentsFromGroupName(readerGroup):
    return re.split(":", readerGroup)

def getSubscriptionParamsFromKey(subscriptionKey):
    return re.split(",", subscriptionKey.replace(",)", ")").strip("[]()").replace("'", '').replace(" ",''))

async def onRebalance(oldRevoked,
                      newAssigned,
                      appMsgHandler,
                      appSubMethod,
                      appUnsubAllMethod,
                      syncdataProducer,
                      syncdataRequestor,
                      cleanupMethod,
                      logger):
    await asyncio.gather(*[onPartitionRevoked(partition,
                                              logger) for topic, partition in oldRevoked])
    await asyncio.gather(*[onNewPartitionAssigned(partition,
                                                  appMsgHandler,
                                                  appSubMethod,
                                                  appUnsubAllMethod,
                                                  syncdataProducer,
                                                  syncdataRequestor,
                                                  cleanupMethod,
                                                  logger) for topic, partition in newAssigned])

async def onNewPartitionAssigned(partition,
                                 appMsgHandler,
                                 appSubMethod,
                                 appUnsubAllMethod,
                                 syncdataProducer,
                                 syncdataRequestor,
                                 cleanupMethod,
                                 logger):
    logger.info("New assigned partition: %s", str(partition))
    sm = PubSubTPStateMachine(appMsgHandler,
                              appSubMethod,
                              appUnsubAllMethod,
                              syncdataProducer,
                              syncdataRequestor,
                              cleanupMethod,
                              partition,
                              logger)
    await sm.start()
    tpBook[str(partition)] = sm

async def onPartitionRevoked(partition,
                             logger):
    logger.info("Revoked partition: %s", str(partition))
    try:
        await tpBook[str(partition)].handleEvent("Revoked")
    except Exception as ex:
        logger.warning("Unexpected error while handling revokation for partition: %s, details: %s", str(partition), str(ex))


async def onSyncData(msg, meta, logger):
    msgDict = json.loads(msg)
    appGroup, topic, partition = generateComponentsFromGroupName(msgDict["group"])
    try:
        if "download_end" not in msgDict.keys():
            params = getSubscriptionParamsFromKey(msgDict["key"])
            await (tpBook[str(partition)]).handleEvent("SyncData", params, msgDict["destination_topics"])
        else:
            await (tpBook[str(partition)]).handleEvent("DownloadEnd")
    except Exception as ex:
        logger.warning("Unexpected error while Downloading phase for partition: %s, details: %s", str(partition), str(ex))

async def sendSyncDataRequest(topic,
                              partition,
                              serviceGroup,
                              recvTopic):
    group = generateTopicPartitionGroupId(serviceGroup, topic, partition)
    await produce(pubSubSyncdataRequests, 
                  json.dumps({"group" : group, "destination_topic" : recvTopic}),
                  group,
                  None)

async def sendSycInfo(topic,
                      partition,
                      serviceGroup,
                      subscriptionParams,
                      msg,
                      meta,
                      logger):
    msgDict = json.loads(msg)
    logger.debug("Sending sync msg for: %s", str(subscriptionParams))
    group = generateTopicPartitionGroupId(serviceGroup, topic, partition)
    syncMsgDict = {"key" : subscriptionParams,
                   "group" : group,
                   "action" : msgDict["action"],
                   "destination_topic" : msgDict["destination_topic"]}
    await produce(pubSubSyncdata, json.dumps(syncMsgDict), group, meta)

async def onSubMsg(partition,
                   msg,
                   meta,
                   logger):
    try:
        await tpBook[str(partition)].handleEvent("ExternalSubUnsub", msg, meta)
    except Exception as ex:
        logger.error("Exceptin in Application code, details: %s, traceback: %s", str(ex), traceback.format_exc())
    
async def start(brokers,
                reqTopic,
                appCallback,
                serviceGroup,
                serviceId,
                appSubMethod,
                appUnsubAllMethod,
                logger,
                isInternalService,
                inMsgCallBack):
    syncTopic = serviceId + "_syncIn"
    async def rebalanceCallback(oldRevoked,newAssigned):
        await onRebalance(oldRevoked,
                          newAssigned,
                          appCallback,
                          appSubMethod,
                          appUnsubAllMethod,
                          lambda partition, subscriptionparams, msg, meta: sendSycInfo(reqTopic, 
                                                                                     partition,
                                                                                     serviceGroup,
                                                                                     subscriptionparams,
                                                                                     msg,
                                                                                     meta,
                                                                                     logger),
                          lambda partition : sendSyncDataRequest(reqTopic,
                                                                        partition,
                                                                        serviceGroup,
                                                                        syncTopic),
                          lambda partition : tpBook.pop(str(partition)),
                          logger)
    individualConsumerDict = {syncTopic : lambda topic, partition, key, msg, meta : onSyncData(msg, meta, logger) }
    if isInternalService:
        individualConsumerDict[serviceId] = lambda topic, partition, key, msg, meta : inMsgCallBack(msg, meta)
    await startCommunication({reqTopic : lambda topic, partition, key, msg, meta : onSubMsg(partition, msg, meta, logger)},
                             individualConsumerDict,
                             brokers,
                             serviceId,
                             serviceGroup,
                             logger,
                             True,
                             [syncTopic, serviceId] if isInternalService else [syncTopic],
                             [[reqTopic], rebalanceCallback])
