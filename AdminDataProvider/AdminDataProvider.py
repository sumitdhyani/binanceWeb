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
allowedMissedHeartbeats = 7
heartbeatBook = {}

# key dest_topic, value: set of subscription criteria json
subscriptions = {}

timer = Timer()
async def increaseMissedHeartBeats(otherApp, parentFunc):
    heartbeatBook[otherApp] = heartbeatBook[otherApp] + 1
    logger.info("Heartbeat missed for %s, total missed heartbeats: %s", otherApp, str(heartbeatBook[otherApp]))
    if heartbeatBook[otherApp] >= allowedMissedHeartbeats:
        logger.info("Exceeded allowed misssed hearbeats for %s", otherApp)
        msgDict = {"evt" : "app_down", "appId" : otherApp, "appGroup" : (appMetadata[otherApp])["appGroup"] }
        msgBody = json.dumps(msgDict)
        logger.info("Ending the app_down evt, payload: %s", msgBody)
        await produce("admin_events", msgBody, otherApp, None)
        heartbeatBook.pop(otherApp)
        appMetadata.pop(otherApp)
        await timer.unsetTimer(parentFunc)
        if otherApp in subscriptions.keys():
            logger.info("%s was a subscriber, removing it from subscriber list", otherApp)
            subscriptions.pop(otherApp)

        
async def onHeartbeat(msg, meta):
    msgDict = json.loads(msg)
    otherApp = msgDict["appId"]
    if otherApp in appMetadata.keys():
        heartbeatBook[otherApp] = 0
        return
        
    if "appGroup" in msgDict.keys():
        logger.warn("hearbeat received for unregistered app, app_id: %s, msg: %s, sending component enquiry(only for web_server)", otherApp, msg)
        await produce(otherApp, json.dumps({"destination_topic" : appId, "message_type" : "component_enquiry"}), otherApp, meta)

async def onRegistration(msg, meta):
    msgDict = json.loads(msg)
    app_id = msgDict["appId"]
    logger.info("Registration for component: %s, json: %s", app_id, msg)
    if app_id in appMetadata.keys():
        return

    logger.info("Registration for component: %s, json: %s, sending component enquiry", app_id, msg)
    await produce(app_id, json.dumps({"destination_topic" : appId, "message_type" : "component_enquiry"}), app_id, meta)
    msgDict["evt"] = "app_up"
    await produce("admin_events", json.dumps(msgDict), msgDict["appId"], meta)

async def componentEnquiryResponse(msg, msgDict, meta):
    app_id = msgDict["appId"]
    logger.info("Component enquiry response from component: %s, json: %s", app_id, msg)
    if app_id not in appMetadata.keys():
        appMetadata[app_id] = msgDict.copy()
        heartbeatBook[app_id] = 0
        async def dummyFunc():
            await increaseMissedHeartBeats(app_id, dummyFunc) 
        await timer.setTimer(5, dummyFunc)
        logger.info("Heartbeat timer activated for: %s", app_id)

    logger.info("Processing Component enquiry response from component: %s", app_id)
    for dest_topic, suscriptionStrings in subscriptions.items():
        for suscriptionString in suscriptionStrings:
            subscriptionCriteriaDict = json.loads(suscriptionString)
            logger.info("Trying to match %s with: subscription: %s, dest_topic", app_id, suscriptionString, dest_topic)
            if "eq" not in subscriptionCriteriaDict.keys():
                continue
            equalityDict = subscriptionCriteriaDict["eq"]
            matched = True
            for key in equalityDict.keys():
                matched = matched and key in msgDict.keys() and msgDict[key] == equalityDict[key]
            if matched:
                logger.info("%s matched sending update to: %s", app_id, dest_topic)
                await produce(dest_topic, json.dumps({"message_type" : "component_subscription_update", "component" : msgDict}), dest_topic, meta)

async def onInBoundMessage(msg, meta):
    msgDict = json.loads(msg)
    message_type = msgDict["message_type"]
    if message_type == "component_enquiry_response":
        await componentEnquiryResponse(msg, msgDict, meta)
    elif message_type == "component_subscription":
        await onAdminSubscription(msg, msgDict, meta)

async def onAdminQuery(msg, meta):
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
    await produce(destTopic, json.dumps(responseDict), destTopic, meta)

async def onAdminSubscription(msg, msgDict, meta):
    destTopic = msgDict["destination_topic"]
    if destTopic not in subscriptions.keys():
        subscriptions[destTopic] = set()
    subscriptionStrings = subscriptions[destTopic]
    # always send 
    # if msg in subscriptionStrings:
    #     return

    subscriptionStrings.add(msg)
    results = []
    logger.info("Received admin subscription: %s, current metadata: %s", msg, str(appMetadata))
    if "eq" in msgDict.keys():
        equalityDict = msgDict["eq"]
        results = [metaData for app, metaData in appMetadata.items() if all(key in metaData.keys() and metaData[key] == equalityDict[key]
                   for key in equalityDict.keys())]
                   
    for result in results:
        resultStr = json.dumps({"message_type" : "component_subscription_update", "component" : result})
        logger.info("Sending subscription response admin subscription: %s, destTopic: %s, Result: %s", msg, destTopic, resultStr)
        await produce(destTopic, resultStr, destTopic, meta)

async def onAdminEvent(msg, meta):
    pass
    

async def run():
    await startCommunication({"admin_queries" : onAdminQuery, "admin_subscriptions" : onAdminSubscription},
                             {"heartbeats" : onHeartbeat, "registrations" : onRegistration, "admin_events" : onAdminEvent, appId : onInBoundMessage},
                             broker,
                             appId,
                             "admin_data_provider",
                             logger,
                             False,
                             [appId])
    
asyncio.run(run())

