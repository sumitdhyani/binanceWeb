import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import logging, asyncio, Keys, sys, binance
from datetime import datetime
from DepthDataProvider import DepthDataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from enum import Enum

logger = logging.getLogger('tcpserver')
#logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.DEBUG)
FORMAT = '%(asctime)-15s %(message)s'
now = datetime.now()
FILENAME= "MD_" + str(now.date()) + ".log"
logging.basicConfig(format=FORMAT, filename=FILENAME)

async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    class DepthHolder:
        def __init__(self, symbol):
            self.symbol = symbol
        async def onDepth(self, depth):
            bids = depth.get_bids()
            asks = depth.get_asks()
            logger.debug("%s : %s, %s", self.symbol, str(bids[0][0]), str(asks[1][0]))
    
    blocker = asyncio.Event()
    try:      
        for i in range(1, len(sys.argv)):
            await ddp.subscribe(sys.argv[i], DepthHolder(sys.argv[i]).onDepth)
        await blocker.wait()
    except KeyboardInterrupt:
        blocker.set()
        print("Closing client connection")
        client.close_connection()


    


asyncio.run(run())
