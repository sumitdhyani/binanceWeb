import os, sys, json, inspect, asyncio, binance, aiokafka, re, traceback
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
parentdir = os.path.dirname(parentdir)
sys.path.insert(0, parentdir)
import Keys
from DepthDataProvider import DepthDataProvider
from TradeDataProvider import TradeDataProvider
from MockDepthDataProvider import MockDepthDataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
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

depthSubscriptionBook = {}
tradeSubscriptionBook = {}

async def onPrice(depth):
    global totalOutGoingMessages
    totalOutGoingMessages += 1
    bids = depth.get_bids()
    asks = depth.get_asks()
    bidLen = min(5, len(bids))
    askLen = min(5, len(asks))
    logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
    if depth.symbol in depthSubscriptionBook.keys():
        destinations = list(depthSubscriptionBook[depth.symbol])
        msgDict = {"message_type" : "depth",
                   "exchange" : "BINANCE",
                   "symbol" : depth.symbol,
                   "bids" : bids[0:bidLen],
                   "asks" : asks[0:askLen],
                   "destination_topics" : destinations
                   }
        await produce("prices", json.dumps(msgDict), depth.symbol, None)
    else:
        logger.warn("Price recieved for unsubscribed symbol: %s", depth.symbol)

async def onTrade(trade):
    logger.debug("Trade recd: %s", trade)

async def cancelAllSubscriptions(symbol, depthUnsubscriptionFunc, tradeUnsubscriptionFunc):
    if symbol in depthSubscriptionBook:
        depthUnsubscriptionFunc(symbol, onPrice)
        depthSubscriptionBook.pop(symbol)
    else:
        logger.warning("Depth cancelAllSubscriptions called for a spurious symbol: %s", symbol)
    
    if symbol in tradeSubscriptionBook:
        tradeSubscriptionBook(symbol, onPrice)
        tradeSubscriptionBook.pop(symbol)
    else:
        logger.warning("Trade cancelAllSubscriptions called for a spurious symbol: %s", symbol)

async def registerDepthSubscription(subscriptionFunc, symbol, destinationTopic):
    if symbol not in depthSubscriptionBook.keys():
        depthSubscriptionBook[symbol] = set([destinationTopic])
        await subscriptionFunc(symbol, onPrice)
        return (symbol,"depth",)
    elif destinationTopic not in depthSubscriptionBook[symbol]:
        depthSubscriptionBook[symbol].add(destinationTopic)
        return (symbol,"depth",)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", symbol, destinationTopic)

def unregisterDepthSubscription(unsubscriptionFunc, symbol, destinationTopic):
    try:
        if symbol in depthSubscriptionBook.keys():
            depthSubscriptionBook[symbol].remove(destinationTopic)
            if 0 == len(depthSubscriptionBook[symbol]):
                unsubscriptionFunc(symbol, onPrice)
                depthSubscriptionBook.pop(symbol)
            return (symbol,"depth",)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", symbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s topic %s which is not an active listener for this symbol", symbol, destinationTopic)

async def registerTradeSubscription(subscriptionFunc, symbol, destinationTopic):
    if symbol not in tradeSubscriptionBook.keys():
        tradeSubscriptionBook[symbol] = set([destinationTopic])
        await subscriptionFunc(symbol, onTrade)
        return (symbol,"trade",)
    elif destinationTopic not in tradeSubscriptionBook[symbol]:
        tradeSubscriptionBook[symbol].add(destinationTopic)
        return (symbol,"trade",)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", symbol, destinationTopic)

def unregisterTradeSubscription(unsubscriptionFunc, symbol, destinationTopic):
    try:
        if symbol in tradeSubscriptionBook.keys():
            tradeSubscriptionBook[symbol].remove(destinationTopic)
            if 0 == len(depthSubscriptionBook[symbol]):
                unsubscriptionFunc(symbol, onTrade)
                tradeSubscriptionBook.pop(symbol)
            return (symbol,"trade",)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", symbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s topic %s which is not an active listener for this symbol", symbol, destinationTopic)


async def onSubMsg(msg, 
                   depthSubscriptionFunc,
                   depthUnsubscriptionFunc,
                   tradeSubscriptionFunc,
                   tradeUnsubscriptionFunc):
    msgDict = json.loads(msg)
    global totalIncommingMessages
    totalIncommingMessages += 1
    symbol = msgDict["symbol"]
    action = msgDict["action"]
    type = msgDict["type"]
    dest_topic = msgDict["destination_topic"]
    return await takeAction(symbol,
                      action,
                      type,
                      dest_topic,
                      depthSubscriptionFunc,
                      depthUnsubscriptionFunc,
                      tradeSubscriptionFunc,
                      tradeUnsubscriptionFunc)

async def takeAction(symbol,
                     action,
                     type,
                     dest_topic,
                     depthSubscriptionFunc,
                     depthUnsubscriptionFunc,
                     tradeSubscriptionFunc,
                     tradeUnsubscriptionFunc):
    if("subscribe" == action):
        if("depth" == type):
            return await registerDepthSubscription(depthSubscriptionFunc, symbol, dest_topic)
        elif("trade" == type):
            return await registerTradeSubscription(tradeSubscriptionFunc, symbol, dest_topic)
    else:
        if("depth" == type):
            return unregisterDepthSubscription(depthUnsubscriptionFunc, symbol, dest_topic)
        elif("trade" == type):
            return await unregisterTradeSubscription(tradeUnsubscriptionFunc, symbol, dest_topic)

async def run():
    try:
        client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
        networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
        ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
        tdp = TradeDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    except Exception as ex:
        logger.error("Error while connecting to market, details: %s", str(ex))
        return
  
    await PubSubService.start(broker,
                              "binance_price_subscriptions",
                              lambda msg, meta : onSubMsg(msg, ddp.subscribe, ddp.unsubscribe, tdp.subscribe, tdp.unsubscribe),
                              "binance_price_fetcher",
                              appId,
                              lambda symbol, type, dest_topic : takeAction("subscribe",
                                                                          symbol,
                                                                          type,
                                                                          dest_topic,
                                                                          ddp.subscribe,
                                                                          ddp.unsubscribe,
                                                                          tdp.subscribe,
                                                                          tdp.unsubscribe),
                              lambda symbol : cancelAllSubscriptions(symbol, ddp.unsubscribe, tdp.unsubscribe),
                              logger,
                              False,
                              None)

#async def run():
#    global totalIncommingMessages
#    global totalOutGoingMessages
#    logger.info("Started mock version of mkt gwy")
#    ddp = MockDepthDataProvider(logger)
#    timer = Timer()
#
#    async def dummyFunc():
#        logger.warn("Total in: %s, total out: %s, totalSunscriptions: %s", str(totalIncommingMessages), str(totalOutGoingMessages), str(len(subscriptionBook)))
#        
#    await timer.setTimer(1, dummyFunc)
#    await PubSubService.start(broker,
#                              "binance_price_subscriptions",
#                              lambda msg, meta : onSubMsg(msg, ddp.subscribe, ddp.unsubscribe),
#                              "price_fetcher",
#                              appId,
#                              lambda symbol, destTopic : registerSubscription(ddp.subscribe, symbol, destTopic),
#                              lambda symbol : cancelAllSubscriptions(symbol, ddp.unsubscribe),
#                              logger,
#                              False,
#                              None)


asyncio.run(run())
