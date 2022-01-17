import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import logging, asyncio, Keys, sys, binance
from datetime import datetime
from DepthDataProvider import DepthDataProvider
from ConversionDataProvider import ConversiondataProvider
from NetworkComplaintHandler import NetworkComplaintHandler

logger = logging.getLogger('tcpserver')
#logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.DEBUG)
FORMAT = '%(asctime)-15s %(message)s'
now = datetime.now()
FILENAME= "Conversion_" + str(now.date()) + ".log"
logging.basicConfig(format=FORMAT, filename=FILENAME)

async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    cdp = ConversiondataProvider(lambda x, y : x + y, lambda pair, curr : pair[0 : pair.find(curr)], ddp.subscribe, ddp.unsubscribe, logger)
    class DepthHolder:
        def __init__(self, symbol):
            self.symbol = symbol
        async def onDepth(self, depth):
            logger.debug("%s : %s, %s", self.symbol, str(depth[0][0]), str(depth[1][0]))
    
    blocker = asyncio.Event()
    try:      
        for i in range(0, len(sys.argv) -3, 3):
            await cdp.subscribe(sys.argv[i+1], sys.argv[i+2], sys.argv[i+3], DepthHolder(sys.argv[i+1] + "_" + sys.argv[i+2] + sys.argv[i+3]).onDepth)
        await blocker.wait()
    except KeyboardInterrupt:
        blocker.set()
        print("Closing client connection")
        client.close_connection()


    


asyncio.run(run())
