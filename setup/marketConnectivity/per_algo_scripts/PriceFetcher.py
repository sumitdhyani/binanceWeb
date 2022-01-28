import os, sys, inspect
from selectors import EpollSelector
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import logging, asyncio, Keys, sys, binance, json, aiokafka
from datetime import datetime
from DepthDataProvider import DepthDataProvider
from ConversionDataProvider import ConversiondataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from enum import Enum

logger = logging.getLogger('tcpserver')
#logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.DEBUG)
FORMAT = '%(asctime)-15s %(message)s'
now = datetime.now()
FILENAME= "TestLog_" + str(now.date()) + ".log"
logging.basicConfig(format=FORMAT, filename=FILENAME)

broker = sys.argv[1]
class VirtualPriceHandler:
    def __init__(self, producer, asset, currency, bridge):
        self.producer = producer
        self.asset = asset
        self.currency = currency
        self.bridge = bridge

    async def onPrice(self, depth):
        #logger.debug("%s : %s, %s", self.symbol, str(depth[0][0]), depth[1][0])
        msgDict = {"symbol" : self.asset + self.currency, "asset" : self.asset, "currency" : self.currency, "bridge" : self.bridge, "bids" : [depth[0]], "asks" : [depth[1]]}
        await self.producer.send_and_wait("virtual_prices", bytes(json.dumps(msgDict), 'utf-8'))        

class PriceHandler:
    def __init__(self, producer):
        self.producer = producer

    async def onPrice(self, depth):
        bids = depth.get_bids()
        asks = depth.get_asks()
        bidLen = min(5, len(bids))
        askLen = min(5, len(asks))
        #logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
        msgDict = {"symbol" : depth.symbol, "bids" : bids[0:bidLen], "asks" : asks[0:askLen]}
        await self.producer.send_and_wait("prices", bytes(json.dumps(msgDict), 'utf-8'))

    
priceSubscriptionBook = {}    
virtualPriceSubscriptionBook = {}

async def subscribeNormalPrice(ddp, producer, symbol):
    if symbol not in priceSubscriptionBook.keys():
        priceHandler = PriceHandler(producer)
        priceSubscriptionBook[symbol] = [0, priceHandler.onPrice]
    
    count, callback = priceSubscriptionBook[symbol]
    count += 1
    if 1 == count:
        await ddp.subscribe(symbol, callback)

def unsubscribeNormalPrice(ddp, symbol):
    if symbol in priceSubscriptionBook.keys():
        count, callback = priceSubscriptionBook[symbol]
        if 1 == count:
            ddp.unsubscribe(symbol, callback)
            priceSubscriptionBook.pop(symbol)
        else:
            count -= 1

async def subscribeVirtualPrice(cdp, producer, asset, currency, bridge):
    virtualSymbol = asset + currency
    if virtualSymbol not in virtualPriceSubscriptionBook.keys():
        priceHandler = VirtualPriceHandler(producer, asset, currency, bridge)
        virtualPriceSubscriptionBook[virtualSymbol] = [0, priceHandler.onPrice]
    
    count, callback = virtualPriceSubscriptionBook[virtualSymbol]
    count += 1
    if 1 == count:
        await cdp.subscribe(bridge, asset, currency, callback)

def unsubscribeVirtualPrice(cdp, asset, currency, bridge):
    virtualSymbol = asset + currency
    if virtualSymbol in virtualPriceSubscriptionBook.keys():
        count, callback = virtualPriceSubscriptionBook[virtualSymbol]
        if 1 == count:
            cdp.unsubscribe(bridge, asset, currency, callback)
            virtualPriceSubscriptionBook.pop(virtualSymbol)
        else:
            count -= 1


async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    cdp = ConversiondataProvider(lambda x, y : x + y, lambda pair, curr : pair[0 : pair.find(curr)], ddp.subscribe, ddp.unsubscribe, logger)
    consumer = aiokafka.AIOKafkaConsumer("price_subscriptions", "virtual_price_subscriptions",
                                         bootstrap_servers=broker
                                        )
    producer = aiokafka.AIOKafkaProducer(bootstrap_servers=broker)
    await producer.start()
    await consumer.start()
    priceHandler = PriceHandler(producer)
    try:
        async for kafkaMsg in consumer:
            msg = kafkaMsg.value.decode("utf-8")
            topic = kafkaMsg.topic
            logger.debug("Subscription received: %s", msg)
            msgDict = json.loads(msg)
            action = msgDict["action"]
            if("subscribe" == action):
                (await subscribeNormalPrice(ddp, producer, msgDict["symbol"]) if topic == "price_subscriptions" else
                await subscribeVirtualPrice(cdp, producer, msgDict["asset"], msgDict["currency"], msgDict["bridge"]))
            else:
                (unsubscribeNormalPrice(ddp, msgDict["symbol"]) if topic == "price_subscriptions" else
                unsubscribeVirtualPrice(cdp, msgDict["asset"], msgDict["currency"], msgDict["bridge"]))
    finally:
        await consumer.stop()

asyncio.run(run())
