import os, sys, json, inspect, asyncio, binance, aiokafka, re, traceback
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
parentdir = os.path.dirname(parentdir)
sys.path.insert(0, parentdir)
from MockDepthDataProvider import MockDepthDataProvider
from CommonUtils import getLoggingLevel, getLogger, Timer
from CommunicationLayer import produce
import PubSubService
totalIncommingMessages = 0
totalOutGoingMessages = 0

broker = sys.argv[1]
#broker = re.split(",", sys.argv[1])
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

subscriptionBook = {}

async def onPrice(depth):
    global totalOutGoingMessages
    totalOutGoingMessages += 1
    bids = depth.get_bids()
    asks = depth.get_asks()
    bidLen = min(5, len(bids))
    askLen = min(5, len(asks))
    logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
    if depth.symbol in subscriptionBook.keys():
        destinations = list(subscriptionBook[depth.symbol])
        msgDict = {"message_type" : "depth",
                   "exchange" : "FAKEX",
                   "symbol" : depth.symbol,
                   "bids" : bids[0:bidLen],
                   "asks" : asks[0:askLen],
                   "destination_topics" : destinations
                   }
        await produce("prices", json.dumps(msgDict), depth.symbol, None)
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

async def onSubMsg(msg, subscriptionFunc, unsubscriptionFunc):
    msgDict = json.loads(msg)
    global totalIncommingMessages
    totalIncommingMessages += 1
    symbol = msgDict["symbol"]
    action = msgDict["action"]
    dest_topic = msgDict["destination_topic"]
    if("subscribe" == action):
        return await registerSubscription(subscriptionFunc, symbol, dest_topic)
    else:
        return unregisterSubscription(unsubscriptionFunc, symbol, dest_topic)


async def run():
    global totalIncommingMessages
    global totalOutGoingMessages
    logger.info("Started mock version of mkt gwy")
    ddp = MockDepthDataProvider(logger)
    timer = Timer()

    #async def dummyFunc():
    #    logger.warn("Total in: %s, total out: %s, totalSunscriptions: %s", str(totalIncommingMessages), str(totalOutGoingMessages), str(len(subscriptionBook)))
    #    
    #await timer.setTimer(1, dummyFunc)
    await PubSubService.start(broker,
                              "fakex_price_subscriptions",
                              lambda msg, meta : onSubMsg(msg, ddp.subscribe, ddp.unsubscribe),
                              "fakex_price_fetcher",
                              appId,
                              lambda symbol, destTopic : registerSubscription(ddp.subscribe, symbol, destTopic),
                              lambda symbol : cancelAllSubscriptions(symbol, ddp.unsubscribe),
                              logger,
                              False,
                              None)


asyncio.run(run())
