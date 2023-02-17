import os, sys, inspect, asyncio, json, re
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger
from CommunicationLayer import startCommunication, produce
  
broker = sys.argv[1]
appId = sys.argv[2]
print(sys.argv[3])
exchangeToTopicDictionary = json.loads(sys.argv[3])
loggingLevel = getLoggingLevel(sys.argv[4]) if(len(sys.argv) >= 5) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)


async def onData(topic, partition, key, msg):
    try:
        msg = json.loads(msg)
        await produce(exchangeToTopicDictionary.get(msg["exchange"]), json.dumps(msg), key)
    except KeyError:
        logger.info("Exchange not supported: %s", msg["exchange"])
    except Exception as ex:
        logger.info("Unexpected exception while routing the request: %s, details: %s", json.dumps(msg), str(ex))        

async def run():
    await startCommunication({"price_subscriptions" : onData},
                             {},
                             broker,
                             appId,
                             "request_router",
                             logger,
                             True)
asyncio.run(run())