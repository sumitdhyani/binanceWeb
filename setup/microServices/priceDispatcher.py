import os, sys, inspect
currentdir = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))
parentdir = os.path.dirname(currentdir)
sys.path.insert(0, parentdir)
import asyncio, sys, json, aiokafka
from datetime import datetime
from CommonUtils import getLoggingLevel, getLogger
  
broker = sys.argv[1]
appId = sys.argv[2]
loggingLevel = getLoggingLevel(sys.argv[3]) if(len(sys.argv) >= 4) else getLoggingLevel("")

subscriptionBook = {}
logger = getLogger(loggingLevel, appId)

async def dispatchPrice(producer, dict, raw):
    symbol = dict["symbol"]
    rawBytes = bytes(raw, 'utf-8')
    if symbol in subscriptionBook.keys():
        await asyncio.gather(*[producer.send_and_wait(topic, rawBytes) for topic in subscriptionBook[symbol]])
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
