from curses import meta
import os, sys, inspect, asyncio, json
from random import setstate
from ssl import ALERT_DESCRIPTION_UNKNOWN_PSK_IDENTITY
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger, Timer
from CommunicationLayer import startCommunication, produce

broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

appMetadata = {}
allowedMissedHeartbeats = 3
heartbeatBook = {}

timer = Timer()
async def increaseMissedHeartBeats(otherApp, parentFunc):
    heartbeatBook[otherApp] += 1
    if heartbeatBook[otherApp] >= allowedMissedHeartbeats:
        await produce("admin_events", json.dumps({"evt" : "app_down", "appId" : otherApp}), otherApp)
        heartbeatBook.pop(otherApp)
        appMetadata.pop(otherApp)
        await timer.unsetTimer(parentFunc)
        
async def onHeartbeat(msg):
    msgDict = json.loads(msg)
    otherApp = msgDict["appId"]
    if otherApp not in heartbeatBook.keys():
        heartbeatBook[otherApp] = 0
        async def dummyFunc():
            await increaseMissedHeartBeats(otherApp, dummyFunc)
        await timer.setTimer(5, dummyFunc)
    else:
        heartbeatBook[otherApp] -= 1
    
async def onRegistration(msg):
    msgDict = json.loads(msg)
    appMetadata[msgDict["appId"]] = msgDict.copy()
    msgDict["evt"] = "app_up"
    await produce("admin_events", json.dumps(msgDict), msgDict["appId"])

async def onAdminQuery(msg):
    msgDict = json.loads(msg)
    destTopic = msgDict["destination_topic"] 
    responseDict = {"message_type" : "admin_query_response"}
    results = []
    if "eq" in msgDict.keys():
        equalityDict = msgDict["eq"]
        results = [metaData for app, metaData in appMetadata.items() if all(key in metaData.keys() and metaData[key] == equalityDict[key]
                   for key in equalityDict.keys())]
    else:    
        results = [metaData for app,
                   metaData in appMetadata.items()]
                   
    responseDict["results"] = results
    logger.info("Received admin query: %s, current metadata: %s, result: %s", msg, str(appMetadata), str(responseDict))
    await produce(destTopic, json.dumps(responseDict), destTopic)

async def onAdminEvent(msg):
    msgDict = json.loads(msg)
    evt = msgDict["evt"]
    if "app_up" == evt:
        otherApp = msgDict["appId"]
        appMetadata[otherApp] = msgDict
    

async def run():
    await startCommunication({"heartbeats" : onHeartbeat, "admin_queries" : onAdminQuery},
                             {"registrations" : onRegistration, "admin_events" : onAdminEvent},
                             broker,
                             appId,
                             "admin_data_provider",
                             logger)
    
asyncio.run(run())

