import os, sys, inspect, asyncio, binance
from DepthManagerWrapper import DepthManagerWrapper
from aiohttp import ClientConnectorError
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import AsyncEvent
import binance

class TradeDataProvider:
    def __init__(self, client, awaitConnectionUpFunc ,logger):
        self.client = client
        self.subscriberDictionary = {}
        self.awaitConnectionUpFunc = awaitConnectionUpFunc
        self.logger = logger
        self.tradeSocketGenerator = binance.BinanceSocketManager(client)


    async def subscribe(self, symbol, callback):
        if symbol not in self.subscriberDictionary.keys():
            self.subscriberDictionary[symbol] = AsyncEvent.AsyncEvent()
            self.subscriberDictionary[symbol] += callback
            await asyncio.wait([asyncio.sleep(0), self.retreiveAndNotifyTrade(symbol)], return_when=asyncio.FIRST_COMPLETED)
        else:
            self.subscriberDictionary[symbol] += callback

    async def retreiveAndNotifyTrade(self, symbol):
        subscriptionPresent = True
        try:
            #start any sockets here, i.e a trade socket
            ts = self.tradeSocketGenerator.trade_socket('BNBBTC')
            self.logger.info("Opened trade stream for %s", symbol)
            async with ts as ts_socket:
                while subscriptionPresent:
                    self.logger.debug("Fetching %s", symbol)
                    trade = await ts_socket.recv()
                    if subscriptionPresent := symbol in self.subscriberDictionary.keys():
                        if not trade:
                            raise Exception("Null trade recieved for " + symbol)
                        else:
                            await self.subscriberDictionary[symbol](trade)# async execution of all the callbacks
        except TimeoutError as ex:
            self.logger.warning("Got TimeoutError while fetching depth for symbol: %s, details: %s, awaiting for the connection to be up again and restarting the price fetch loop", symbol, str(ex))
            await self.awaitConnectionUpFunc()
        except ClientConnectorError as ex:
            self.logger.warning("Got ClientConnectorError while fetching depth for symbol: %s, details: %s, awaiting for the connection to be up again and restarting the price fetch loop", symbol, str(ex))
            await self.awaitConnectionUpFunc()
        except Exception as ex:
            self.logger.warning("Got exception while fetching depth for symbol: %s, details: %s, restarting the price fetch loop", symbol, str(ex))

        try:
            await ts.close()
            self.logger.info("Closed trade stream for %s", symbol)
        except Exception as ex:
            self.logger.warning("Got exception while closing trade connection for symbol: %s, details: %s", symbol, str(ex))

        if subscriptionPresent:
            await asyncio.wait([asyncio.sleep(0), self.retreiveAndNotifyDepth(symbol)], return_when=asyncio.FIRST_COMPLETED)
        else:
            self.logger.debug("No trade subscriptions are now active for %s", symbol)

    def unsubscribe(self, symbol, callback):
        if symbol in self.subscriberDictionary.keys():
            try:
                self.logger.debug("Unsubscribing %s", symbol)
                evt = self.subscriberDictionary[symbol]
                evt -= callback
                if evt.empty():
                    del self.subscriberDictionary[symbol]
            except:
                self.logger.warning("Spurious trade unsubscription for %s", symbol)
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
