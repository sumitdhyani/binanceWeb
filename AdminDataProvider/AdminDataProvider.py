import os, sys, inspect, asyncio, json
from ssl import ALERT_DESCRIPTION_UNKNOWN_PSK_IDENTITY
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
from CommonUtils import getLoggingLevel, getLogger, timer
from CommunicationLayer import startCommunication, produce

broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

apps = {}
allowedMissedHeartbeats = 3

async def increaseMissedHeartBeats(otherApp):
    apps[otherApp] += 1
    if apps[otherApp] >= allowedMissedHeartbeats:
        apps.pop(otherApp)
        await produce("admin_events", json.dumps({"evt" : "app_down", "appId" : otherApp}), otherApp)
        
async def onHeartbeat(msg):
    msgDict = json.loads(msg)
    otherApp = msgDict["appId"]
    if otherApp not in apps:
        apps[otherApp] = 1
        await produce("admin_events", json.dumps({"evt" : "app_up", "appId" : otherApp}), otherApp)
        await timer(5, lambda : increaseMissedHeartBeats(otherApp))
    apps[otherApp] -= 1

async def run():
    await startCommunication({"heartbeats" : onHeartbeat},
                             {},
                             broker,
                             appId,
                             "admin_data_provider",
                             logger)
    
asyncio.run(run())

