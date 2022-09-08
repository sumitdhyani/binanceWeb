import asyncio
from AsyncFSM import AFSM, AFSMState, SpecialEvents
from enum import Enum

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
                 cleanupMethod,
                 partition,
                 logger):
        super().__init__(lambda : Syncing(appMsghandler,
                                          appSubMethod,
                                          appUnsubAllMethod,
                                          syncdataProducer,
                                          syncdataRequestor,
                                          cleanupMethod,
                                          partition,
                                          self,
                                          logger))
class Syncing(AFSMState):
    def __init__(self,
                 appMsghandler,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 syncdataRequestor,
                 cleanupMethod,
                 partition,
                 selfStateMachine,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.syncdataRequestor = syncdataRequestor
        self.cleanupMethod = cleanupMethod
        self.partition = partition
        self.logger = logger
        self.subscriptionKeys = set()
        async def retryDownload():
            await asyncio.sleep(5)
            await selfStateMachine.handleEvent("RetryDownLoad")
        self.retryFunc = retryDownload
    
    async def after_entry(self):
        self.logger.info("Entered Syncing state, partition: %s", str(self.partition))
        await self.syncdataRequestor(self.partition)
        self.logger.info("Syncing state, partition: %s, sent sync request", str(self.partition))
        await asyncio.wait([asyncio.sleep(0), self.retryFunc()], return_when=asyncio.FIRST_COMPLETED)
    
    async def on_SyncData(self, symbolRelatedSubscriptionParams, destTopics):
        self.logger.info("on_SyncData in Syncing state, partition: %s", str(self.partition))
        for destTopic in destTopics:
            appParams = symbolRelatedSubscriptionParams + [destTopic]
            if await self.appSubMethod(*appParams) is not None:
                self.subscriptionKeys.add(tuple(symbolRelatedSubscriptionParams))
        return Downloading(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.cleanupMethod,
                           self.partition,
                           self.logger)

    async def on_RetryDownLoad(self):
        self.logger.info("on_RetryDownLoad in Syncing state, partition: %s", str(self.partition))
        await self.syncdataRequestor(self.partition)
        await asyncio.wait([asyncio.sleep(0), self.retryFunc()], return_when=asyncio.FIRST_COMPLETED)
        self.logger.info("Syncing state, partition: %s, sent sync request", str(self.partition))

    async def on_DownloadEnd(self):
        self.logger.info("on_DownloadEnd in Syncing state, partition: %s", str(self.partition))
        return Operational(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.cleanupMethod,
                           self.partition,
                           self.logger)
    
    async def on_Revoked(self):
        return SpecialEvents.defer
    
    async def on_ExternalSubUnsub(self, msgDict):
        self.logger.warning("Deferring on_ExternalSubUnsub event, partition: %s", str(self.partition))
        return SpecialEvents.defer

class Downloading(AFSMState):
    def __init__(self,
                 appMsghandler,
                 subscriptionKeys,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 cleanupMethod,
                 partition,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.subscriptionKeys = subscriptionKeys
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.cleanupMethod = cleanupMethod
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

    async def on_ExternalSubUnsub(self, msgDict):
        self.logger.warning("Deferring on_ExternalSubUnsub event, partition: %s", str(self.partition))
        return SpecialEvents.defer
        
    async def on_DownloadEnd(self):
        self.logger.info("on_DownloadEnd in Downloading state, partition: %s", str(self.partition))
        return Operational(self.appMsghandler,
                           self.subscriptionKeys,
                           self.appSubMethod,
                           self.appUnsubAllMethod,
                           self.syncdataProducer,
                           self.cleanupMethod,
                           self.partition,
                           self.logger)
        
class Operational(AFSMState):
    def __init__(self,
                 appMsghandler,
                 subscriptionKeys,
                 appSubMethod,
                 appUnsubAllMethod,
                 syncdataProducer,
                 cleanupMethod,
                 partition,
                 logger):
        super().__init__(False)
        self.appMsghandler = appMsghandler
        self.subscriptionKeys = subscriptionKeys
        self.appSubMethod = appSubMethod
        self.appUnsubAllMethod = appUnsubAllMethod
        self.syncdataProducer = syncdataProducer
        self.cleanupMethod = cleanupMethod
        self.partition = partition
        self.logger = logger

    async def after_entry(self):
        self.logger.info("Entered Operational state, partition: %s", str(self.partition))
    
    async def on_ExternalSubUnsub(self, msgDict):
        self.logger.info("on_ExternalSubUnsub in Operational state, partition: %s", str(self.partition))
        subParams = await self.appMsghandler(msgDict)
        if subParams is not None:
            self.subscriptionKeys.add(subParams)
            await self.syncdataProducer(self.partition, subParams, msgDict)
            
    async def on_Revoked(self):
        self.logger.info("on_Revoked in Operational state, partition: %s", str(self.partition))
        return Revoked(self.subscriptionKeys,
                       self.appUnsubAllMethod,
                       self.cleanupMethod,
                       self.partition,
                       self.logger)
    
class Revoked(AFSMState):
    def __init__(self,
                 subscriptionKeys,
                 appUnsubAllMethod,
                 cleanupMethod,
                 partition,
                 logger):
        super().__init__(True)
        self.subscriptionKeys = subscriptionKeys
        self.appUnsubAllMethod = appUnsubAllMethod
        self.cleanupMethod = cleanupMethod
        self.partition = partition
        self.logger = logger
    
    async def after_entry(self):
        self.logger.info("Entered revoked state, partition: %s", str(self.partition))
        for subscriptionKey in self.subscriptionKeys:
            await self.appUnsubAllMethod(*subscriptionKey)
    
    async def before_exit(self):
        self.cleanupMethod(self.partition)
        
        
        
