import os, sys, inspect, asyncio, json
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger
from CommunicationLayer import startCommunication, produce
pubSubSyncdata = "pubSub_sync_data"
pubSubSyncdataRequests = "pubSub_sync_data_requests"

broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

#What is variable book, key: reader_group, value: subscriptionBook for the group
#What is "subscriptionBook for the group" you ask,
#it's a dictionary with key as symbol and value as the list of destination(reader) topics
book = {}

def onSub(group, key, destTopic):
    if group not in book.keys():
        book[group] = {}
    
    subscriptionBookForThisGroup = book[group]
    if key not in subscriptionBookForThisGroup.keys():
        subscriptionBookForThisGroup[key] = []
    subscriptionBookForThisGroup[key].append(destTopic)

def onUnsub(group, key, destTopic):
    if group not in book.keys():
        logger.warning("Data requested for non-existent group: %s", group)
    elif key not in book[group]:
        logger.warning("Attempt to unsubscribe the key %s which is not actively subscribed", key)
    else:
        try:
            (book[group])[key].remove(destTopic)
            if 0 == len((book[group])[key]):
                book[group].pop(key)
        except ValueError:
            logger.warning("Attempt to unsubscribe the dest_topic %s for key %s which is not actively subscribed", destTopic, key)


async def onSyncData(msg):
    msgDict = json.loads(msg)
    action = msgDict["action"]
    selectedFunc = onSub if action == "subscribe" else onUnsub
    selectedFunc(msgDict["group"],
                 msgDict["key"],
                 msgDict["destination_topic"])

async def onSyncDataRequest(msg):
    msgDict = json.loads(msg)

    group = msgDict["group"]
    if group in book.keys():
        destTopic = msgDict["destination_topic"]
        content = json.dumps(book[group])
        logger.info("Producing response to destination: %s, content: %s", destTopic, content)
        await produce(destTopic, content, group)
        await produce(destTopic, json.dumps({"message_type": "downloadEnd"}), group)
    else:
        logger.warning("Data requested for non-existent group: %s", group)
    


async def run():
    await startCommunication({pubSubSyncdata: onSyncData, pubSubSyncdataRequests : onSyncDataRequest},
                             {},
                             broker,
                             appId,
                             appId,
                             logger)
    
asyncio.run(run())
    