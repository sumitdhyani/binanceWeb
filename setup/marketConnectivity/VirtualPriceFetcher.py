import os, sys, inspect, asyncio, json
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from ConversionDataProvider import ConversiondataProvider
from CommunicationLayer import startCommunication, createTopic, produce
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
        callback = self.subscriptionBook.get(symbol)
        if callback is not None:
            await callback(depth)
        else:
            logger.warn("Depth received for unsubscribed symbol %s", symbol)
        
class VirtualPriceHandler:
    def __init__(self, asset, currency, bridge):
        self.asset = asset
        self.currency = currency
        self.bridge = bridge
        
    async def onPrice(self, depth):
        if depth[0][0] is not None and depth[1][0] is not None:
            msgDict = {"message_type" : "virtual_depth",
                       "symbol" : generateTradingPairName(self.asset, self.currency),
                       "asset" : self.asset,
                       "currency" : self.currency,
                       "bridge" : self.bridge,
                       "bids" : [depth[0]],
                       "asks" : [depth[1]]}
            await produce("virtual_prices", bytes(json.dumps(msgDict), 'utf-8'))

vanillaPriceFetcher = VanillaPriceFetcher()
uniqueSubscriptions = {}
cdp = ConversiondataProvider(generateTradingPairName,
                             extractAssetFromSymbolName, 
                             vanillaPriceFetcher.subscribe,
                             vanillaPriceFetcher.unsubscribe,
                             logger)

async def onPriceSubscription(msgDict):
    asset, currency, bridge = msgDict["asset"], msgDict["currency"], msgDict["bridge"]
    virtualInstrument = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualInstrument not in uniqueSubscriptions.keys():
        virtualPriceHandler = VirtualPriceHandler(asset, currency, bridge)
        uniqueSubscriptions[virtualInstrument] = virtualPriceHandler
        await cdp.subscribe(asset, currency, bridge, virtualPriceHandler.onPrice)
        logger.debug("Successful subscription for %s", virtualInstrument)
    else:
        logger.warn("Duplicate subscription for %s", virtualInstrument)

async def onPriceUnsubscription(msgDict):
    asset, currency, bridge = msgDict["asset"], msgDict["currency"], msgDict["bridge"]
    virtualInstrument = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualInstrument in uniqueSubscriptions.keys():
        await cdp.unsubscribe(asset, currency, bridge, uniqueSubscriptions[virtualInstrument].onPrice) 
        uniqueSubscriptions.pop(virtualInstrument)
        logger.debug("Successful unsubscription for %s", virtualInstrument)
    else:
        logger.warn("Spurious unsubscription for %s", virtualInstrument)

async def onSubMsg(msg):
    dict = json.loads(msg)
    action = dict["action"]
    if "subscribe" == action:
        await onPriceSubscription(dict)
    else:
        await onPriceUnsubscription(dict)

async def OnInBoundMsg(msg):
    dict = json.loads(msg)
    msgType = dict["message_type"]
    if(msgType == "depth"):
        await vanillaPriceFetcher.onDepth(dict)
    else:
        logger.warn("Unrecognized message type: %s received", msgType)

async def run():
    try:
        createTopic(appId, 1 , 1)
        await startCommunication({"virtual_price_calculations" : onSubMsg, appId : OnInBoundMsg},
                                 broker,
                                 appId,
                                 "virtual_price_fetcher",
                                 logger)
    except Exception as ex:
        logger.error("Error durig init phase, details: %s, exiting", str(ex))
        

asyncio.run(run())