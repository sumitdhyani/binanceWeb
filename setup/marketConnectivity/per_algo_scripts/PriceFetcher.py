import os, sys, inspect
from selectors import EpollSelector
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
sys.path.insert(0, os.path.dirname(parentdir))
import asyncio, Keys, sys, binance, json, aiokafka
from DepthDataProvider import DepthDataProvider
from ConversionDataProvider import ConversiondataProvider
from NetworkComplaintHandler import NetworkComplaintHandler
from CommonUtils import getLoggingLevel, getLogger
  
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")
logger = getLogger(loggingLevel, appId)

class VirtualPriceHandler:
    def __init__(self, producer, asset, currency, bridge):
        self.producer = producer
        self.asset = asset
        self.currency = currency
        self.bridge = bridge

    async def onPrice(self, depth):
        #logger.debug("%s : %s, %s", self.asset + self.currency, str(depth[0][0]), depth[1][0])
        if depth[0][0] is not None and depth[1][0] is not None:
            msgDict = {"message_type" : "virtual_depth", "symbol" : self.asset + self.currency, "asset" : self.asset, "currency" : self.currency, "bridge" : self.bridge, "bids" : [depth[0]], "asks" : [depth[1]]}
            await self.producer.send_and_wait("virtual_prices", bytes(json.dumps(msgDict), 'utf-8'))        

class PriceHandler:
    def __init__(self, producer):
        self.producer = producer

    async def onPrice(self, depth):
        bids = depth.get_bids()
        asks = depth.get_asks()
        bidLen = min(5, len(bids))
        askLen = min(5, len(asks))
        logger.debug("%s : %s, %s", depth.symbol, str(bids[0][0]), str(asks[1][0]))
        msgDict = {"message_type" : "depth", "symbol" : depth.symbol, "bids" : bids[0:bidLen], "asks" : asks[0:askLen]}
        await self.producer.send_and_wait("prices", bytes(json.dumps(msgDict), 'utf-8'))

    
priceSubscriptionBook = {}    
virtualPriceSubscriptionBook = {}

async def subscribeNormalPrice(ddp, producer, symbol):
    if symbol not in priceSubscriptionBook.keys():
        priceHandler = PriceHandler(producer)
        priceSubscriptionBook[symbol] = [0, priceHandler.onPrice]
    
    countAndCallback = priceSubscriptionBook[symbol]
    countAndCallback[0] += 1
    if 1 == countAndCallback[0]:
        await ddp.subscribe(symbol, countAndCallback[1])

def unsubscribeNormalPrice(ddp, symbol):
    if symbol in priceSubscriptionBook.keys():
        countAndCallback = priceSubscriptionBook[symbol]
        if 1 == countAndCallback[0]:
            ddp.unsubscribe(symbol, countAndCallback[1])
            priceSubscriptionBook.pop(symbol)
        else:
            countAndCallback[0] -= 1

async def subscribeVirtualPrice(cdp, producer, asset, currency, bridge):
    virtualSymbol = asset + currency
    if virtualSymbol not in virtualPriceSubscriptionBook.keys():
        priceHandler = VirtualPriceHandler(producer, asset, currency, bridge)
        virtualPriceSubscriptionBook[virtualSymbol] = [0, priceHandler.onPrice]
    
    countAndCallback = virtualPriceSubscriptionBook[virtualSymbol]
    countAndCallback[0] += 1
    if 1 == countAndCallback[0]:
        await cdp.subscribe(bridge, asset, currency, countAndCallback[1])

def unsubscribeVirtualPrice(cdp, asset, currency, bridge):
    virtualSymbol = asset + currency
    if virtualSymbol in virtualPriceSubscriptionBook.keys():
        countAndCallback = virtualPriceSubscriptionBook[virtualSymbol]
        if 1 == countAndCallback[0]:
            cdp.unsubscribe(bridge, asset, currency, countAndCallback[1])
            virtualPriceSubscriptionBook.pop(virtualSymbol)
        else:
            countAndCallback[0] -= 1


async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    networkComplaintHandler = NetworkComplaintHandler("https://www.binance.com/")
    ddp = DepthDataProvider(client, networkComplaintHandler.registerComplaint, logger)
    cdp = ConversiondataProvider(lambda x, y : x + y, lambda pair, curr : pair[0 : pair.find(curr)], ddp.subscribe, ddp.unsubscribe, logger)
    consumer = aiokafka.AIOKafkaConsumer("price_subscriptions", "virtual_price_subscriptions",
                                         bootstrap_servers=broker,
                                         group_id="price_fetcher"
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
