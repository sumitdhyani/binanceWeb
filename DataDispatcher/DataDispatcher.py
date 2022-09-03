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

async def dispatchData(topic, partition, key, msg):
    dict = json.loads(msg)
    if "destination_topics" in dict.keys():
        destination_topics = dict["destination_topics"]
        await asyncio.gather(*[produce(destination_topic, msg, key) for destination_topic in destination_topics])
    else:
        logger.error("Message with missing destination tag received, content: %s", msg)        

async def run():
    dict = {}
    for inboundTopic in inboundTopics:
        dict[inboundTopic] = dispatchData
        
    await startCommunication(dict,
                             {},
                             broker,
                             appId,
                             "data_dispatcher",
                             logger,
                             True)
asyncio.run(run())
