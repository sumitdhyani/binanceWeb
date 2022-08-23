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
logger = getLogger(loggingLevel, appId)

async def dispatchPrice(msg):
    dict = json.loads(msg)
    destination_topics = dict["destination_topics"]
    rawBytes = bytes(msg, 'utf-8')
    await asyncio.gather(*[produce(destination_topic, rawBytes) for destination_topic in destination_topics])

async def run():
    await startCommunication({"prices" : dispatchPrice},
                              broker,
                              appId,
                              "price_dispatcher",
                              logger)
asyncio.run(run())
