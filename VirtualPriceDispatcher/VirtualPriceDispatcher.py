import os, sys, inspect, asyncio, json
from pydoc_data.topics import topics
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

def generateSubMsgBytes(asset, currency, bridge):
    dict = { "asset": asset, "currency": currency, "bridge": bridge, "action": "subscribe" }
    return bytes(json.dumps(dict), 'utf-8')

def generateUnSubMsgBytes(asset, currency, bridge):
    dict = { "asset": asset, "currency": currency, "bridge": bridge, "action": "unsubscribe" }
    return bytes(json.dumps(dict), 'utf-8')

async def dispatchPrice(msg):
    dict = json.loads(msg)
    asset, currency, bridge = dict["asset"], dict["currency"], dict["bridge"] 
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    if virtualSymbol in subscriptionBook.keys():
        rawBytes = bytes(msg, 'utf-8')
        await asyncio.gather(*[produce(topic, rawBytes) for topic in subscriptionBook[virtualSymbol]])
    else:
        logger.warn("Price received for unsubscribed symbol %s", virtualSymbol)

async def registerSubscription(asset, currency , bridge, virtualSymbol, destinationTopic):
    if virtualSymbol not in subscriptionBook.keys():
        subscriptionBook[virtualSymbol] = set([destinationTopic])
        await produce("virtual_price_calculations", generateSubMsgBytes(asset, currency, bridge))
    elif destinationTopic not in subscriptionBook[virtualSymbol]:
        subscriptionBook[virtualSymbol].add(destinationTopic)
    else:
        logger.warn("Duplicate subscription attempted for: %s destination topic: %s", virtualSymbol, destinationTopic)
        
async def unregisterSubscription(asset, currency, bridge, virtualSymbol, destinationTopic):
    try:
        if virtualSymbol in subscriptionBook.keys():
            subscriptionBook[virtualSymbol].remove(destinationTopic)
            if 0 == len(subscriptionBook[virtualSymbol]):
                await produce("virtual_price_calculations", generateUnSubMsgBytes(asset, currency, bridge))
                subscriptionBook.pop(virtualSymbol)
        else:
            logger.warn("Unsubscription attempted for %s which has no active subscriptions", virtualSymbol)
    except KeyError:
        logger.warn("Unsubscription attempted for %s topic %s which is not an active listener for this symbol", virtualSymbol, destinationTopic)

async def onSubMsg(msg):
    msgDict = json.loads(msg)
    asset, currency, bridge = msgDict["asset"], msgDict["currency"], msgDict["bridge"]
    virtualSymbol = generateVirtualTradingPairName(asset, currency, bridge)
    action = msgDict["action"]
    dest_topic = msgDict["destination_topic"]
    if("subscribe" == action):
        await registerSubscription(asset, currency, bridge, virtualSymbol, dest_topic)
    else:
        await unregisterSubscription(asset, currency, bridge, virtualSymbol, dest_topic)

async def run():
    await startCommunication({"virtual_price_subscriptions" : onSubMsg, "virtual_prices" : dispatchPrice},
                              broker,
                              appId,
                              "virtual_price_dispatcher",
                              logger)

asyncio.run(run())
