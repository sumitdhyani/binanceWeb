import os, sys, inspect, asyncio, json
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from ConversionDataProvider import ConversiondataProvider
from CommunicationLayer import startCommunication, produce
from CommonUtils import getLoggingLevel, getLogger
from CommonUtils import generateBinanceTradingPairName as generateTradingPairName
from CommonUtils import generateBinanceVirtualTradingPairName as generateVirtualTradingPairName
from CommonUtils import extractAssetFromSymbolName
import PubSubService

#Reading commandline params
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

class VanillaPriceFetcher:
    def __init__(self):
        self.subscriptionBook = {}

    async def subscribe(self, symbol, callback, meta):
        if symbol not in self.subscriptionBook.keys():
            self.subscriptionBook[symbol] = callback
            msgDict = { "symbol": symbol, "action" : "subscribe", "destination_topic" : appId }
            await produce("price_subscriptions", json.dumps(msgDict), symbol, meta)
        else:
            logger.warn("Internally Duplicate subscription for %s", symbol)

    async def unsubscribe(self, symbol, callback, meta):
        try:
            self.subscriptionBook.pop(symbol)
            msgDict = { "symbol": symbol, "action" : "unsubscribe", "destination_topic" : appId }
            await produce("price_subscriptions", json.dumps(msgDict), symbol, meta)
        except KeyError:
            logger.warn("Internally spurious unsubscription for %s", symbol)
    
    async def onDepth(self, depth, meta):
        symbol = depth["symbol"]
        if symbol in self.subscriptionBook.keys():
            await self.subscriptionBook[symbol](depth, meta)
        else:
            logger.warn("Internally Depth received for unsubscribed symbol %s", symbol)

vanillaPriceFetcher = VanillaPriceFetcher()
subscriptionBook = {}
cdp = ConversiondataProvider(generateTradingPairName,
                             extractAssetFromSymbolName, 
                             vanillaPriceFetcher.subscribe,
                             vanillaPriceFetcher.unsubscribe,
                             logger)

async def cancelAllSubscriptions(unsubscriptionFunc, asset, currency, bridge):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualSymbol in subscriptionBook.keys():
        await unsubscriptionFunc(asset, currency, bridge, onPrice)
        subscriptionBook.pop(virtualSymbol)
        logger.warn("cancelAllSubscriptions for %s", virtualSymbol)
    else:
        logger.warn("In cancelAllSubscriptions, %s which has no active subscriptions", virtualSymbol)
        
async def onPrice(depth, asset, currency, bridge, meta):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    if (depth[0][0] is not None and 
        depth[1][0] is not None and
        virtualSymbol in subscriptionBook.keys()
        ):
        destinations = list(subscriptionBook[virtualSymbol])
        msgDict = {"message_type" : "virtual_depth",
                    "symbol" : generateVirtualTradingPairName(asset, currency, bridge),
                    "asset" : asset,
                    "currency" : currency,
                    "bridge" : bridge,
                    "bids" : [depth[0]],
                    "asks" : [depth[1]],
                    "destination_topics" : destinations}
        await produce("virtual_prices", json.dumps(msgDict), virtualSymbol, meta)
    else:
        logger.warn("Price recieved for unsubscribed virtual symbol: %s", virtualSymbol)

async def registerSubscription(subscriptionFunc, asset, currency, bridge, destinationTopic, meta):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualSymbol not in subscriptionBook.keys():
        subscriptionBook[virtualSymbol] = set([destinationTopic])
        await subscriptionFunc(asset, currency, bridge, onPrice, meta)
        logger.debug("Successful subscription for %s, destination topic: %s", virtualSymbol, destinationTopic)
        return (asset, currency, bridge)
    elif destinationTopic not in subscriptionBook[virtualSymbol]:
        subscriptionBook[virtualSymbol].add(destinationTopic)
        logger.debug("Successful subscription for %s, destination topic: %s", virtualSymbol, destinationTopic)
        return (asset, currency, bridge)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", virtualSymbol, destinationTopic)

async def unregisterSubscription(unsubscriptionFunc, asset, currency, bridge, destinationTopic, meta):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    try:
        if virtualSymbol in subscriptionBook.keys():
            subscriptionBook[virtualSymbol].remove(destinationTopic)
            if 0 == len(subscriptionBook[virtualSymbol]):
                await unsubscriptionFunc(asset, currency, bridge, onPrice, meta)
                subscriptionBook.pop(virtualSymbol)
            return (asset, currency, bridge)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", virtualSymbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s, destination topic: %s which is not an active listener for this symbol", virtualSymbol, destinationTopic)

async def onSubMsg(msg, meta):
    msgDict = json.loads(msg)
    action = msgDict["action"]
    if "subscribe" == action:
        return await registerSubscription(cdp.subscribe, msgDict["asset"], msgDict["currency"], msgDict["bridge"], msgDict["destination_topic"], meta)
    else:
        return await unregisterSubscription(cdp.unsubscribe, msgDict["asset"], msgDict["currency"], msgDict["bridge"], msgDict["destination_topic"], meta)

async def OnInBoundMsg(msg, meta):
    msgDict = json.loads(msg)
    msgType = msgDict["message_type"]
    if(msgType == "depth"):
        await vanillaPriceFetcher.onDepth(msgDict, meta)
    else:
        logger.warn("Unrecognized message type: %s received", msgType)

async def run():
    await PubSubService.start(broker,
                              "virtual_price_subscriptions",
                              onSubMsg,
                              "virtual_price_fetcher",
                              appId,
                              lambda asset, currency, bridge, destTopic : registerSubscription(cdp.subscribe, asset, currency, bridge, destTopic),
                              lambda asset, currency, bridge : cancelAllSubscriptions(asset, currency, bridge),
                              logger,
                              True,
                              OnInBoundMsg)

asyncio.run(run())