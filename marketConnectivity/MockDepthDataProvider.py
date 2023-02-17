import os, sys, inspect, asyncio
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import AsyncEvent

class MockDepth:
    def __init__(self, symbol, avgPrice):
        self.symbol = symbol
        self.avgPrice = avgPrice
        self.bids = [[100,10],[99,10]]
        self.asks = [[101,10],[102,10]]
    
    def get_bids(self):
        return self.bids

    def get_asks(self):
        return self.asks

class MockDepthDataProvider:
    def __init__(self, logger):
        self.subscriberDictionary = {}
        self.logger = logger

    async def subscribe(self, symbol, callback):
        self.logger.debug("New subscripton for %s", symbol)
        if symbol not in self.subscriberDictionary.keys():
            self.subscriberDictionary[symbol] = AsyncEvent.AsyncEvent()
            self.subscriberDictionary[symbol] += callback
            await asyncio.wait([asyncio.sleep(0), self.retreiveAndNotifyDepth(symbol)], return_when=asyncio.FIRST_COMPLETED)
        else:
            self.subscriberDictionary[symbol] += callback

    async def retreiveAndNotifyDepth(self, symbol):
        subscriptionPresent = True
        while subscriptionPresent:
            self.logger.debug("Fetching %s", symbol)
            depth = MockDepth(symbol, 100)
            await self.subscriberDictionary[symbol](depth)# async execution of all the callbacks
            await asyncio.sleep(1)
        self.logger.debug("No subscriptions are now active for %s", symbol)

    def unsubscribe(self, symbol, callback):
        if symbol in self.subscriberDictionary.keys():
            try:
                self.logger.debug("Unsubscribing %s", symbol)
                evt = self.subscriberDictionary[symbol]
                evt -= callback
                if evt.empty():
                    del self.subscriberDictionary[symbol]
            except:
                self.logger.warning("Spurious unsubscription for %s", symbol)
                pass


##################################################    Unit Tests    ##################################################
# import logging
# from datetime import datetime
# import asyncio
# import DepthDataProvider
# import Keys
# import uuid
# import sys
#
# FORMAT = '%(asctime)-15s %(message)s'
# now = datetime.now()
# FILENAME= "TestLog_" + str(now.date()) + ".log"
# logging.basicConfig(format=FORMAT, filename=FILENAME)
# logger = logging.getLogger('tcpserver')
# logger.addHandler(logging.StreamHandler(sys.stdout))
# logger.setLevel(logging.INFO)
#
# async def onDepth(depth):
#     logger.info("Depth received for %s", depth.symbol)
#     print(depth.get_bids()[:5])
#     print(depth.get_asks()[:5])
#
#
# async def unsubscribe(ddp, symbol, callback, waithInterval):
#     await asyncio.sleep(waithInterval)
#     ddp.unsubscribe(symbol, callback)
#
#
# class DepthListener:
#     def __init__(self, name):
#         self.name = name
#
#     async def onDepth(self, depth):
#         print("Depth received by " + self.name + " for " + depth.symbol)
#
#
# class DepthSubscriber:
#     def __init__(self, name, ddp, symbol):
#         self.name = name
#         self.ddp = ddp
#         self.symbol = symbol
#
#     async def start(self):
#         await self.ddp.subscribe(self.symbol, self.onDepth)
#
#     async def onDepth(self, depth):
#         print("Depth received by " + self.name + " for " + depth.symbol)
#         await asyncio.sleep(5)
#         self.ddp.unsubscribe(self.symbol, self.onDepth)
#
#
# async def simpleSubscriptiontest():
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     await asyncio.gather(ddp.subscribe('BTCUSDT', onDepth), ddp.subscribe('ETHUSDT', onDepth), unsubscribe(ddp, 'BTCUSDT', onDepth ,5), unsubscribe(ddp, 'BTCUSDT', simpleSubscriptiontest, 10), unsubscribe(ddp, 'ETHUSDT', onDepth, 15))
#
#     await client.close_connection()
#
# async def infiniteRun():
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     await asyncio.gather(ddp.subscribe('BTCUSDT', onDepth), ddp.subscribe('ETHUSDT', onDepth))
#     evt = asyncio.Event()
#     await evt.wait()
#     await client.close_connection()
#
# async def classMethodSubscriptiontest():
#     btcListener = DepthListener("BTC")
#     ethListener = DepthListener("ETH")
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     await asyncio.gather(ddp.subscribe('BTCUSDT', btcListener.onDepth),
#                          ddp.subscribe('ETHUSDT', ethListener.onDepth),
#                          unsubscribe(ddp, 'BTCUSDT', btcListener.onDepth, 10),
#                          unsubscribe(ddp, 'ETHUSDT', ethListener.onDepth, 20)
#                          )
#     await client.close_connection()
#
#
# async def classMethodSubscriptiontestMultipleMethodsOnOneSymbol():
#     btcListener1 = DepthListener("BTC1")
#     btcListener2 = DepthListener("BTC2")
#
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     await asyncio.gather(ddp.subscribe('BTCUSDT', btcListener1.onDepth),
#                          ddp.subscribe('BTCUSDT', btcListener2.onDepth),
#                          unsubscribe(ddp, 'BTCUSDT', btcListener1.onDepth, 10),
#                          unsubscribe(ddp, 'BTCUSDT', btcListener2.onDepth, 20)
#                          )
#     await client.close_connection()
#
#
# async def classMethodSubscriptiontestWithSelfMethods():
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     btcSubscriber = DepthSubscriber("BTC", ddp, "BTCUSDT")
#     await btcSubscriber.start()
#     await client.close_connection()
#
#asyncio.run(infiniteRun())
#asyncio.run(simpleSubscriptiontest())
#asyncio.run(classMethodSubscriptiontest())
#asyncio.run(classMethodSubscriptiontestMultipleMethodsOnOneSymbol())
#asyncio.run(classMethodSubscriptiontestWithSelfMethods())
#print("Exiting Application")
