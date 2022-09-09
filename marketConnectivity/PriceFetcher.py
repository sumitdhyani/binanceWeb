import os, sys, json, inspect, asyncio, binance, aiokafka, re
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import Keys
from DepthDataProvider import DepthDataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from CommonUtils import getLoggingLevel, getLogger
from CommunicationLayer import produce
import PubSubService

broker = sys.argv[1]
#broker = re.split(",", sys.argv[1])
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

subscriptionBook = {}

async def onPrice(depth):
    bids = depth.get_bids()
    asks = depth.get_asks()
    bidLen = min(5, len(bids))
    askLen = min(5, len(asks))
    logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
    if depth.symbol in subscriptionBook.keys():
        destinations = list(subscriptionBook[depth.symbol])
        msgDict = {"message_type" : "depth",
                   "symbol" : depth.symbol,
                   "bids" : bids[0:bidLen],
                   "asks" : asks[0:askLen],
                   "destination_topics" : destinations
                   }
        await produce("prices", json.dumps(msgDict), depth.symbol)
    else:
        logger.warn("Price recieved for unsubscribed symbol: %s", depth.symbol)
        
async def cancelAllSubscriptions(symbol, unsubscriptionFunc):
    if symbol in subscriptionBook:
        unsubscriptionFunc(symbol, onPrice)
        subscriptionBook.pop(symbol)
    else:
        logger.warning("cancelAllSubscriptions called for a spurious symbol: %s", symbol)
    
async def registerSubscription(subscriptionFunc, symbol, destinationTopic):
    if symbol not in subscriptionBook.keys():
        subscriptionBook[symbol] = set([destinationTopic])
        await subscriptionFunc(symbol, onPrice)
        return (symbol,)
    elif destinationTopic not in subscriptionBook[symbol]:
        subscriptionBook[symbol].add(destinationTopic)
        return (symbol,)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", symbol, destinationTopic)

def unregisterSubscription(unsubscriptionFunc, symbol, destinationTopic):
    try:
        if symbol in subscriptionBook.keys():
            subscriptionBook[symbol].remove(destinationTopic)
            if 0 == len(subscriptionBook[symbol]):
                unsubscriptionFunc(symbol, onPrice)
                subscriptionBook.pop(symbol)
            return (symbol,)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", symbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s topic %s which is not an active listener for this symbol", symbol, destinationTopic)

async def onSubMsg(msgDict, subscriptionFunc, unsubscriptionFunc):
    symbol = msgDict["symbol"]
    action = msgDict["action"]
    dest_topic = msgDict["destination_topic"]
    if("subscribe" == action):
        return await registerSubscription(subscriptionFunc, symbol, dest_topic)
    else:
        return unregisterSubscription(unsubscriptionFunc, symbol, dest_topic)


async def run():
    try:
        client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
        networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
        ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    except Exception as ex:
        logger.error("Error while connecting to market, details: %s", str(ex))
        return
    
    await PubSubService.start(broker,
                              "price_subscriptions",
                              lambda msg : onSubMsg(msg, ddp.subscribe, ddp.unsubscribe),
                              "price_fetcher",
                              appId,
                              lambda symbol, destTopic : registerSubscription(ddp.subscribe, symbol, destTopic),
                              lambda symbol : cancelAllSubscriptions(symbol, ddp.unsubscribe),
                              logger,
                              False,
                              None)

asyncio.run(run())
