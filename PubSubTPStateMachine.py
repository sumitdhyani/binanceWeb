import asyncio
from AsyncFSM import AFSM, AFSMState, SpecialEvents, FinalityReachedException
from enum import Enum
from CommonUtils import Timer

class SubscriptionAction(Enum):
    subscribe = "subscribe"
    unsubscribe = "unsubscribe"

class PubSubTPStateMachine(AFSM):
    def __init__(self,
                 appMsghandler,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 syncdataRequestor,
                 partition,
                 logger):
        super().__init__(lambda : Syncing(appMsghandler,
                                          appSubMethod,
                                          appUnsubAllMethod,
                                          syncdataProducer,
                                          syncdataRequestor,
                                          partition,
                                          logger))
class Syncing(AFSMState):
    def __init__(self,
                 appMsghandler,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 syncdataRequestor,
                 partition,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.syncdataRequestor = syncdataRequestor
        self.partition = partition
        self.logger = logger
        self.subscriptionKeys = set()
        self.timer = Timer()

        async def retryDownload():
            self.logger.info("Entered Syncing state, partition: %s", str(self.partition))
            await self.syncdataRequestor(self.partition)
            self.logger.info("Syncing state, partition: %s, sent sync request", str(self.partition))
        self.retryFunc = retryDownload
    
    async def after_entry(self):
        await self.timer.setTimer(5, self.retryFunc)
    
    async def on_SyncData(self, symbolRelatedSubscriptionParams, destTopics):
        await self.timer.unsetTimer(self.retryFunc)
        self.logger.debug("on_SyncData in Syncing state, partition: %s", str(self.partition))
        for destTopic in destTopics:
            appParams = symbolRelatedSubscriptionParams + [destTopic]
            self.logger.info(f"appParams: {str(appParams)}")
            if await self.appSubMethod(*appParams) is not None:
                self.subscriptionKeys.add(tuple(symbolRelatedSubscriptionParams))
        return Downloading(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.syncdataRequestor,
                           self.partition,
                           self.logger)

    async def on_DownloadEnd(self):
        await self.timer.unsetTimer(self.retryFunc)
        self.logger.info("on_DownloadEnd in Syncing state, partition: %s", str(self.partition))
        return Operational(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.syncdataRequestor,
                           self.partition,
                           self.logger)
    
    async def on_Revoked(self):
        return SpecialEvents.defer
    
    async def on_ExternalSubUnsub(self, msg, meta):
        self.logger.warning("Deferring on_ExternalSubUnsub event, partition: %s", str(self.partition))
        return SpecialEvents.defer

class Downloading(AFSMState):
    def __init__(self,
                 appMsghandler,
                 subscriptionKeys,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 syncdataRequester,
                 partition,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.subscriptionKeys = subscriptionKeys
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.syncdataRequester = syncdataRequester
        self.partition = partition
        self.logger = logger
    
    async def after_entry(self):
        self.logger.info("Entered Downloading state, partition: %s", str(self.partition))
    
    async def on_SyncData(self, symbolRelatedSubscriptionParams, destTopics):
        self.logger.info("on_SyncData in Downloading state, partition: %s", str(self.partition))
        for destTopic in destTopics:
            appParams = symbolRelatedSubscriptionParams + [destTopic]
            if await self.appSubMethod(*appParams) is not None:
                self.subscriptionKeys.add(tuple(symbolRelatedSubscriptionParams))
                
    async def on_Revoked(self):
        return SpecialEvents.defer

    async def on_ExternalSubUnsub(self, msg, meta):
        self.logger.warning("Deferring on_ExternalSubUnsub event, partition: %s", str(self.partition))
        return SpecialEvents.defer
        
    async def on_DownloadEnd(self):
        self.logger.info("on_DownloadEnd in Downloading state, partition: %s", str(self.partition))
        return Operational(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.syncdataRequester,
                           self.partition,
                           self.logger)
        
class Operational(AFSMState):
    def __init__(self,
                 appMsghandler,
                 subscriptionKeys,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 syncDataRequester,
                 partition,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.subscriptionKeys = subscriptionKeys
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.syncDataRequester = syncDataRequester
        self.partition = partition
        self.logger = logger

    async def after_entry(self):
        self.logger.info("Entered Operational state, partition: %s", str(self.partition))
    
    async def on_ExternalSubUnsub(self, msg, meta):
        self.logger.debug("on_ExternalSubUnsub in Operational state, partition: %s", str(self.partition))
        subParams = await self.appMsghandler(msg, meta)
        if subParams is not None:
            self.subscriptionKeys.add(subParams)
            await self.syncdataProducer(self.partition, subParams, msg, meta)
            
    async def on_Revoked(self):
        self.logger.info("on_Revoked in Operational state, partition: %s", str(self.partition))
        return Revoked(self.subscriptionKeys,
                       self.appUnsubAllMethod,
                       self.partition,
                       self.appMsghandler,
                       self.appSubMethod,
                       self.syncdataProducer,
                       self.syncDataRequester,
                       self.logger)
    
class Revoked(AFSMState):
    def __init__(self,
                 subscriptionKeys,
                 appUnsubAllMethod,
                 partition,
                 appMsghandler,
                 appSubMethod,
                 syncdataProducer,
                 syncdataRequestor,
                 logger):
        super().__init__(False)
        self.subscriptionKeys = subscriptionKeys
        self.appUnsubAllMethod = appUnsubAllMethod
        self.partition = partition
        self.appMsghandler = appMsghandler
        self.appSubMethod = appSubMethod
        self.syncdataProducer = syncdataProducer
        self.syncdataRequestor = syncdataRequestor
        self.logger = logger
    
    async def after_entry(self):
        self.logger.info("Entered revoked state, partition: %s", str(self.partition))
        for subscriptionKey in self.subscriptionKeys:
            self.logger.info(f"on_Revoked, subscription key: {str(subscriptionKey)}")
            await self.appUnsubAllMethod(*subscriptionKey)

    async def on_Assigned(self):
        return Syncing(self.appMsghandler,
                       self.appSubMethod,
                       self.appUnsubAllMethod,
                       self.syncdataProducer,
                       self.syncdataRequestor,
                       self.partition,
                       self.logger)        
        
        
