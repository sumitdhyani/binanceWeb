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


async def onSyncData(msg, meta):
    msgDict = json.loads(msg)
    action = msgDict["action"]
    selectedFunc = onSub if action == "subscribe" else onUnsub
    listToTuple = tuple(msgDict["key"])
    selectedFunc(msgDict["group"],
                 listToTuple,
                 msgDict["destination_topic"])

async def onSyncDataRequest(msg, meta):
    msgDict = json.loads(msg)

    group = msgDict["group"]
    destTopic = msgDict["destination_topic"]
    logger.warning("Book status: %s", str(book))
    if group in book.keys():
        dict = {}
        for identifier, destination_topics in book[group].items():
            dict["group"] = group
            dict["key"] = str(identifier)
            dict["destination_topics"] = destination_topics
            content = json.dumps(dict)
            logger.info("Producing response to destination: %s, content: %s", destTopic, content)
            await produce(destTopic, content, group, meta)
    else:
        logger.warning("Data requested for non-existent group: %s", group)
    
    await produce(destTopic, json.dumps({"group" : group, "download_end" : "true"}), group, meta)
    


async def run():
    await startCommunication({"pubSub_sync_data_requests" : onSyncDataRequest},
                             {"pubSub_sync_data": onSyncData},
                             broker,
                             appId,
                             "sync_data_provider",
                             logger)
    
asyncio.run(run())
    