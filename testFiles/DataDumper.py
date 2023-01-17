import os, sys, inspect, asyncio, json, re
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger
from CommunicationLayer import startCommunication, produce
  
broker = sys.argv[1]
appId = sys.argv[2]
inboundTopics = re.split(',', sys.argv[3])
loggingLevel = getLoggingLevel(sys.argv[4]) if(len(sys.argv) >= 5) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)


async def onData(topic, partition, key, msg):
     logger.info("Topic: %s, partition: %s, key: %s, data: %s", topic, partition, key, msg)

async def run():
    dict = {}
    for inboundTopic in inboundTopics:
        logger.info("Found topic to dump: %s", inboundTopic)
        dict[inboundTopic] = onData
        
    await startCommunication(dict,
                             {},
                             broker,
                             appId,
                             "data_dumper",
                             logger,
                             True)
asyncio.run(run())