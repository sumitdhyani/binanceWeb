import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import logging, asyncio, sys, json, aiokafka
from datetime import datetime

def getLoggingLevel(level):
    level_uc = level.upper()
    if level_uc == "ERROR":
        return logging.ERROR
    elif level_uc == "WARN":
        return logging.WARN
    elif level_uc == "INFO":
        return logging.INFO
    elif level_uc == "DEBUG":
        return logging.DEBUG
    
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = logging.INFO
if(len(sys.argv) >= 4):
    loggingLevel= getLoggingLevel(sys.argv[3])

logger = logging.getLogger('tcpserver')
#logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(loggingLevel)
FORMAT = '%(asctime)-15s %(message)s'
now = datetime.now()
FILENAME= appId + "_" + str(now.date()) + ".log"
logging.basicConfig(format=FORMAT, filename=FILENAME)
subscriptionBook = {}

async def dispatchPrice(producer, dict, raw):
    symbol = dict["symbol"]
    if symbol in subscriptionBook.keys():
        await asyncio.gather(*[producer.send_and_wait(topic, bytes(json.dumps(dict), 'utf-8')) for topic in subscriptionBook[symbol]])
    else:
        logger.warn("Price received for unsubscribed symbol")

def registerSubscription(symbol, topic):
    if symbol not in subscriptionBook.keys():
        subscriptionBook[symbol] = set()
    subscriptionBook[symbol].add(topic)

def unregisterSubscription(symbol, topic):
    try:
        if symbol in subscriptionBook.keys():
            subscriptionBook[symbol].remove(topic)
        else:
            logger.warn("Unsubscription attempted for " + symbol + " which has no active subscriptions")
    except KeyError:
        logger.warn("Unsubscription attempted for " + symbol + ", topic " + topic + " which is not an active listener for this symbol")


async def run():
    consumer = aiokafka.AIOKafkaConsumer("price_subscriptions", 
                                         "prices",
                                         bootstrap_servers=broker,
                                         group_id="price_dispatcher"
                                        )
    producer = aiokafka.AIOKafkaProducer(bootstrap_servers=broker)
    await producer.start()
    await consumer.start()
    try:
        async for kafkaMsg in consumer:
            msg = kafkaMsg.value.decode("utf-8")
            topic = kafkaMsg.topic
            logger.debug("Subscription received: %s", msg)
            msgDict = json.loads(msg)

            if "prices" == topic:
                await dispatchPrice(producer, msgDict, msg)
            elif "price_subscriptions" == topic:
                symbol = msgDict["symbol"]
                action = msgDict["action"]
                dest_topic = msgDict["destination_topic"]
                if("subscribe" == action):
                    registerSubscription(symbol, dest_topic)
                else:
                    unregisterSubscription(symbol, dest_topic)
    finally:
        await consumer.stop()

asyncio.run(run())
