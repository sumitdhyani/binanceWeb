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

#Reading commandline params
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

class VanillaPriceFetcher:
    def __init__(self):
        self.subscriptionBook = {}

    async def subscribe(self, symbol, callback):
        if symbol not in self.subscriptionBook.keys():
            self.subscriptionBook[symbol] = callback
            msgDict = { "symbol": symbol, "action" : "subscribe", "destination_topic" : appId }
            await produce("price_subscriptions", bytes(json.dumps(msgDict), 'utf-8'))
        else:
            logger.warn("Internally Duplicate subscription for %s", symbol)

    async def unsubscribe(self, symbol, callback):
        try:
            self.subscriptionBook.pop(symbol)
            msgDict = { "symbol": symbol, "action" : "unsubscribe", "destination_topic" : appId }
            await produce("price_subscriptions", bytes(json.dumps(msgDict), 'utf-8'))
        except KeyError:
            logger.warn("Internally spurious unsubscription for %s", symbol)
    
    async def onDepth(self, depth):
        symbol = depth["symbol"]
        if symbol in self.subscriptionBook.keys():
            await self.subscriptionBook[symbol](depth)
        else:
            logger.warn("Internally Depth received for unsubscribed symbol %s", symbol)

vanillaPriceFetcher = VanillaPriceFetcher()
subscriptionBook = {}
cdp = ConversiondataProvider(generateTradingPairName,
                             extractAssetFromSymbolName, 
                             vanillaPriceFetcher.subscribe,
                             vanillaPriceFetcher.unsubscribe,
                             logger)

        
async def onPrice(depth, asset, currency, bridge):
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
        await produce("virtual_prices", bytes(json.dumps(msgDict), 'utf-8'))
    else:
        logger.warn("Price recieved for unsubscribed virtual symbol: %s", virtualSymbol)

async def registerSubscription(subscriptionFunc, asset, currency, bridge, destinationTopic):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualSymbol not in subscriptionBook.keys():
        subscriptionBook[virtualSymbol] = set([destinationTopic])
        await subscriptionFunc(asset, currency, bridge, onPrice)
        logger.debug("Successful subscription for %s, destination topic: %s", virtualSymbol, destinationTopic)
    elif destinationTopic not in subscriptionBook[virtualSymbol]:
        subscriptionBook[virtualSymbol].add(destinationTopic)
        logger.debug("Successful subscription for %s, destination topic: %s", virtualSymbol, destinationTopic)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", virtualSymbol, destinationTopic)

async def unregisterSubscription(unsubscriptionFunc, asset, currency, bridge, destinationTopic):
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    try:
        if virtualSymbol in subscriptionBook.keys():
            subscriptionBook[virtualSymbol].remove(destinationTopic)
            if 0 == len(subscriptionBook[virtualSymbol]):
                await unsubscriptionFunc(asset, currency, bridge, onPrice)
                subscriptionBook.pop(virtualSymbol)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", virtualSymbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s, destination topic: %s which is not an active listener for this symbol", virtualSymbol, destinationTopic)

async def onSubMsg(msg):
    dict = json.loads(msg)
    action = dict["action"]
    if "subscribe" == action:
        await registerSubscription(cdp.subscribe, dict["asset"], dict["currency"], dict["bridge"], dict["destination_topic"])
    else:
        await unregisterSubscription(cdp.unsubscribe, dict["asset"], dict["currency"], dict["bridge"], dict["destination_topic"])

async def OnInBoundMsg(msg):
    dict = json.loads(msg)
    msgType = dict["message_type"]
    if(msgType == "depth"):
        await vanillaPriceFetcher.onDepth(dict)
    else:
        logger.warn("Unrecognized message type: %s received", msgType)

async def run():
    await startCommunication({"virtual_price_subscriptions" : onSubMsg, appId : OnInBoundMsg},
                                broker,
                                appId,
                                "virtual_price_fetcher",
                                logger,
                                [appId])
        

asyncio.run(run())