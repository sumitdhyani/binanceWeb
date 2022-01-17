import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import logging, asyncio, Keys, sys, binance, json, aiokafka
from datetime import datetime
from DepthDataProvider import DepthDataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from enum import Enum

logger = logging.getLogger('tcpserver')
#logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.DEBUG)
FORMAT = '%(asctime)-15s %(message)s'
now = datetime.now()
FILENAME= "TestLog_" + str(now.date()) + ".log"
logging.basicConfig(format=FORMAT, filename=FILENAME)

async def onPrice(depth):
    bids = depth.get_bids()
    asks = depth.get_asks()
    logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))


async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    consumer = aiokafka.AIOKafkaConsumer("price_subscriptions",
                                         bootstrap_servers='127.0.0.1:9092'
                                        )
    await consumer.start()
    try:
        async for kafkaMsg in consumer:

            msg = kafkaMsg.value.decode("utf-8")
            logger.debug("Subscription received: %s", msg)
            msgDict = json.loads(msg)
            action = msgDict["action"]
            if("subscribe" == action):
                await ddp.subscribe(msgDict["symbol"], onPrice)
            else:
                await ddp.unsubscribe(msgDict["symbol"], onPrice)

    finally:
        await consumer.stop()

asyncio.run(run())
