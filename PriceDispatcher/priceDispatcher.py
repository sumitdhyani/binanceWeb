import os, sys, inspect, asyncio, json
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger
from CommonUtils import generateBinanceVirtualTradingPairName as generateVirtualTradingPairName
from CommunicationLayer import startCommunication, produce
  
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")

subscriptionBook = {}
logger = getLogger(loggingLevel, appId)

def generateSubMsgBytes(symbol):
    dict = { "symbol": symbol, "action": "subscribe" }
    return bytes(json.dumps(dict), 'utf-8')

def generateUnSubMsgBytes(symbol):
    dict = { "symbol": symbol, "action": "unsubscribe" }
    return bytes(json.dumps(dict), 'utf-8')

async def dispatchPrice(msg):
    dict = json.loads(msg)
    symbol = dict["symbol"]
    rawBytes = bytes(msg, 'utf-8')
    if symbol in subscriptionBook.keys():
        await asyncio.gather(*[produce(topic, rawBytes) for topic in subscriptionBook[symbol]])
    else:
        logger.warn("Price received for unsubscribed symbol %s", symbol)

async def registerSubscription(symbol, destinationTopic):
    if symbol not in subscriptionBook.keys():
        subscriptionBook[symbol] = set([destinationTopic])
        await produce("market_price_subscriptions", generateSubMsgBytes(symbol))
    elif destinationTopic not in subscriptionBook[symbol]:
        subscriptionBook[symbol].add(destinationTopic)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", symbol, destinationTopic)

async def unregisterSubscription(symbol, destinationTopic):
    try:
        if symbol in subscriptionBook.keys():
            subscriptionBook[symbol].remove(destinationTopic)
            if 0 == len(subscriptionBook[symbol]):
                await produce("market_price_subscriptions", generateUnSubMsgBytes(symbol))
                subscriptionBook.pop(symbol)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", symbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s topic %s which is not an active listener for this symbol", symbol, destinationTopic)

async def onSubMsg(msg):
    msgDict = json.loads(msg)
    symbol = msgDict["symbol"]
    action = msgDict["action"]
    dest_topic = msgDict["destination_topic"]
    if("subscribe" == action):
        await registerSubscription(symbol, dest_topic)
    else:
        await unregisterSubscription(symbol, dest_topic)

async def run():
    await startCommunication({"price_subscriptions" : onSubMsg, "prices" : dispatchPrice},
                              broker,
                              appId,
                              "price_dispatcher",
                              logger)
asyncio.run(run())
