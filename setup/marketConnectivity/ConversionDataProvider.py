from DepthDataProvider import DepthDataProvider
import asyncio
from AsyncEvent import AsyncEvent

class PerCurrencyConversiondataProvider:
    def __init__(self, bridge, tradingpairNameGenerator, tradingPairNameDisintegrator, subscriberFunc, unsubscriberFunc, logger):
        self.tradingpairNameGenerator = tradingpairNameGenerator
        self.tradingPairNameDisintegrator = tradingPairNameDisintegrator
        self.subscriberFunc = subscriberFunc
        self.unsubscriberFunc = unsubscriberFunc
        self.bridge = bridge
        self.logger = logger
        self.subscriberDictionary = {}
        self.convertedDictionary = {}
        self.converteeDictionary = {}
        self.priceTable = {}


    async def subscribe(self, source, dest, callback): 
        #Subscription table, keeps track of subscribers to this pair
        subscriberPairIdentifier = source + dest
        if subscriberPairIdentifier not in self.subscriberDictionary.keys():
            self.subscriberDictionary[subscriberPairIdentifier] = AsyncEvent()
        self.subscriberDictionary[subscriberPairIdentifier] += callback

        #Decide whether or not to subscribe the market instruments for source and dest
        needToSubscribeSource = False
        needToSubscribeDest = False
        if  not (source in self.convertedDictionary.keys() or source in self.converteeDictionary.keys()):
            needToSubscribeSource = True
        if  not (dest in self.convertedDictionary.keys() or dest in self.converteeDictionary.keys()):
            needToSubscribeDest = True

        #increment the subscription counts in converted and convertee dictionaries
        if source not in self.convertedDictionary.keys():
            self.convertedDictionary[source] = {dest : 0}
        elif dest not in self.convertedDictionary[source].keys():
            self.convertedDictionary[source][dest] = 0

        if dest not in self.converteeDictionary.keys():
            self.converteeDictionary[dest] = {source : 0}
        elif source not in self.converteeDictionary[dest].keys():
            self.converteeDictionary[dest][source] = 0
            
        self.convertedDictionary[source][dest] += 1
        self.converteeDictionary[dest][source] += 1

        #subscribe in open market if needed
        if needToSubscribeSource:
            await self.subscriberFunc(self.tradingpairNameGenerator(source, self.bridge), self.onDepth)
        if needToSubscribeDest:
            await self.subscriberFunc(self.tradingpairNameGenerator(dest, self.bridge), self.onDepth)

    def getPricesForTradingPair(self, source, dest):
        sourceMktPair = self.tradingpairNameGenerator(source, self.bridge)
        destMktPair = self.tradingpairNameGenerator(dest, self.bridge)

        sourcePrices = None if sourceMktPair not in self.priceTable.keys() else self.priceTable[sourceMktPair]
        destPrices = None if destMktPair not in self.priceTable.keys() else self.priceTable[destMktPair]
        bidLevel = (None, None)
        askLevel = (None, None)
        if not(sourcePrices is None or destPrices is None):
            sourceBid, sourceBidQty = sourcePrices[0]
            sourceAsk, sourceAskQty = sourcePrices[1]
            destBid, destBidQty = destPrices[0]
            destAsk, destAskQty = destPrices[1]

            if not(sourceAsk is None or destBid is None):
                bidLevel = (sourceAsk/destBid, min((destBid * destBidQty)/sourceAsk, sourceAskQty))
            
            if not(sourceBid is None or destAsk is None):
                askLevel = (sourceBid/destAsk, min((sourceBid * sourceBidQty)/destAsk, destAskQty))

        return ((bidLevel, askLevel))
        
    async def onDepth(self, depth):
        symbol = depth.symbol
        baseSymbol = self.tradingPairNameDisintegrator(symbol, self.bridge)
        if not(baseSymbol in self.convertedDictionary.keys() or baseSymbol in self.converteeDictionary.keys()):#The symbol was unsubscribed before this update was recieved
            return

        bestBidLevel, bestAskLevel = (None, None),  (None, None)
        if 0 < len(depth.get_bids()):
            bestBidLevel = depth.get_bids()[0]
        if 0 < len(depth.get_asks()):
            bestAskLevel = depth.get_asks()[0]

        self.priceTable[symbol] = (bestBidLevel, bestAskLevel)

        if baseSymbol in self.convertedDictionary.keys():
            for convertee in self.convertedDictionary[baseSymbol].keys():
                await self.subscriberDictionary[baseSymbol + convertee](self.getPricesForTradingPair(baseSymbol, convertee))

        if baseSymbol in self.converteeDictionary.keys():
            for converted in self.converteeDictionary[baseSymbol].keys():
                await self.subscriberDictionary[converted + baseSymbol](self.getPricesForTradingPair(converted, baseSymbol))
    
    async def unsubscribe(self, source, dest, callback):
        tradingPair = source + dest
        if tradingPair not in self.subscriberDictionary.keys():
            return
        try:
            self.logger.debug("Unsubscribing %s", tradingPair)
            evt = self.subscriberDictionary[tradingPair]
            evt -= callback
            if evt.empty():#no more subscribers for this pair
                self.subscriberDictionary.pop(tradingPair)
                self.convertedDictionary[source].pop(dest)
                self.converteeDictionary[dest].pop(source)
                if 0 == len(self.convertedDictionary[source]):
                    self.convertedDictionary.pop(source)
                    if source not in self.converteeDictionary.keys():
                        mktTradingPair = self.tradingpairNameGenerator(source, self.bridge)
                        await self.unsubscriberFunc(mktTradingPair, self.onDepth)
                        self.priceTable.pop(mktTradingPair)
                if 0 == len(self.converteeDictionary[dest]):
                    self.converteeDictionary.pop(dest)
                    if dest not in self.convertedDictionary.keys():
                        mktTradingPair = self.tradingpairNameGenerator(dest, self.bridge)
                        await self.unsubscriberFunc(mktTradingPair, self.onDepth)
                        self.priceTable.pop(mktTradingPair)
            else:
                self.convertedDictionary[source][dest] -= 1
        except Exception as ex:
            self.logger.warning("Exception while unsubscription, params: %s, %s, details %s", source, dest, str(ex))
        
    def empty(self):
        return (0 == len(self.subscriberDictionary))
        
class ConversiondataProvider:
    def __init__(self, tradingpairNameGenerator, tradingPairNameDisintegrator, subscriberFunc, unsubscriberFunc, logger):
        self.tradingpairNameGenerator = tradingpairNameGenerator
        self.tradingPairNameDisintegrator = tradingPairNameDisintegrator
        self.subscriberFunc = subscriberFunc
        self.unsubscriberFunc = unsubscriberFunc
        self.logger = logger
        self.perCurrencyConversiondataProvider = {}
    
    async def subscribe(self, bridge, source, dest, callback):
        if bridge not in self.perCurrencyConversiondataProvider.keys():
            self.perCurrencyConversiondataProvider[bridge] = PerCurrencyConversiondataProvider(bridge, self.tradingpairNameGenerator, self.tradingPairNameDisintegrator, self.subscriberFunc, self.unsubscriberFunc, self.logger)
        await self.perCurrencyConversiondataProvider[bridge].subscribe(source, dest, callback)

    async def unsubscribe(self, bridge, source, dest, callback):
        if bridge in self.perCurrencyConversiondataProvider.keys():
            conversionDataProvider = self.perCurrencyConversiondataProvider[bridge]
            await conversionDataProvider.unsubscribe(source, dest, callback)
            if conversionDataProvider.empty():
                self.perCurrencyConversiondataProvider.pop(bridge)
###############################################################################################
# import logging
# from datetime import datetime
# import asyncio
# from DepthDataProvider import DepthDataProvider
# import Keys
# import uuid
# import sys

# FORMAT = '%(asctime)-15s %(message)s'
# now = datetime.now()
# FILENAME= "Test_" + str(now.date()) + ".log"
# logging.basicConfig(format=FORMAT, filename=FILENAME)
# logger = logging.getLogger('tcpserver')
# logger.addHandler(logging.StreamHandler(sys.stdout))
# logger.setLevel(logging.DEBUG)


# c1 = sys.argv[1]
# c2 = sys.argv[2]
# c = sys.argv[3]

# def generatetradingPairNames(c1, c2, c):
#     return (c1+c, c2+c)



# async def run():
#     client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
#     ddp = DepthDataProvider(client, logger)
#     cdp = ConversiondataProvider(lambda x, y : x + y, lambda pair, curr : pair[0 : pair.find(curr)], ddp.subscribe, ddp.unsubscribe, logger)
#     class DepthHolder:
#         def __init__(self, symbol):
#             self.symbol = symbol
#         async def onDepth(self, depth):
#             print(self.symbol + ": " + str(depth))
          
#     for i in range(1, len(sys.argv), 3):
#         await cdp.subscribe(sys.argv[i+2], sys.argv[i], sys.argv[i+1], DepthHolder(sys.argv[i] + sys.argv[i+1]).onDepth)

#     await asyncio.sleep(120)



# asyncio.run(run())
