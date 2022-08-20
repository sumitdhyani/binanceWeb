import os, sys, json, inspect, asyncio, binance, aiokafka
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import Keys
from DepthDataProvider import DepthDataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from CommonUtils import getLoggingLevel, getLogger
from CommunicationLayer import startCommunication, produce
  
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

subscriptionBook = set()

async def onPrice(depth):
    bids = depth.get_bids()
    asks = depth.get_asks()
    bidLen = min(5, len(bids))
    askLen = min(5, len(asks))
    logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
    msgDict = {"message_type" : "depth", "symbol" : depth.symbol, "bids" : bids[0:bidLen], "asks" : asks[0:askLen]}
    await produce("prices", bytes(json.dumps(msgDict), 'utf-8'))

async def onPriceSubscription(depthDataProvider, symbol):
    if symbol not in subscriptionBook:
        subscriptionBook.add(symbol)
        await depthDataProvider.subscribe(symbol, onPrice)
        logger.info("Subscription for %s", symbol)
    else:
        logger.warn("Duplicate subscription for %s", symbol)
        

def onPriceUnsubscription(depthDataProvider, symbol):
    try:
        subscriptionBook.remove(symbol)
        depthDataProvider.unsubscribe(symbol, onPrice)
        logger.info("Unsubscription for %s", symbol)
    except KeyError:
        logger.warn("Spurious unsubscription for %s", symbol)
        
async def onSubMsg(ddp, msg):
    dict = json.loads(msg)
    action = dict["action"]
    if "subscribe" == action:
        await onPriceSubscription(ddp, dict["symbol"])
    else:
        onPriceUnsubscription(ddp, dict["symbol"])

async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    await startCommunication({"market_price_subscriptions" : lambda msg : onSubMsg(ddp, msg)},
                              broker,
                              appId,
                              "price_fetcher",
                              logger)

asyncio.run(run())
