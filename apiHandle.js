const { Kafka } = require('kafkajs')
const winston = require('winston')
const { Console } = require('winston/lib/winston/transports')

subscriptionBook = {}
producer = null
symbolDict = { "BTCUSDT" : {"symbol" : "BTCUSDT", "description" : "Bitcoin vs USD"}, 
                "ADAUSDT" : {"symbol" : "ADAUSDT", "description" : "Cardano vs USD"},
                "XRPUSDT" : {"symbol" : "XRPUSDT", "description" : "Ripple vs USD"},
                "DOTUSDT" : {"symbol" : "DOTUSDT", "description" : "Polkadot vs USD"}
              }

const toWinstonLogLevel = level => {switch(level) {
    case Kafka.ERROR:
    case Kafka.NOTHING:
        return 'error'
    case Kafka.WARN:
        return 'warn'
    case Kafka.INFO:
        return 'info'
    case Kafka.DEBUG:
        return 'debug'
    default:
        return 'debug'
}}

const WinstonLogCreator = logLevel => {
    const logger = winston.createLogger({
        level: toWinstonLogLevel(logLevel),
        transports: [
            //new winston.transports.Console(),
            new winston.transports.File({ filename: 'myapp.log' })
        ]
    })

    return ({ namespace, level, label, log }) => {
        const { message, ...extra } = log
        logger.log({
            level: toWinstonLogLevel(level),
            message,
            extra,
        })
    }
}

function onPriceData(prices)
{
    dict = JSON.parse(prices)
    symbol = dict["symbol"]
    if(symbol in subscriptionBook)
    {
        callbacks = subscriptionBook[symbol]
        for(let callback of callbacks)
            callback(dict)
    }
}

function onStaticData(staticData)
{
    
}

function subscribeVirtualPrice(bridge, source, dest, callback)
{

}

function unsubscribeVirtualPrice(bridge, source, dest, callback)
{

}


module.exports = {
    downloadAllSymbols : async function(symbolCallback, downloadEndCallback)
    {
        for (const [key, value] of Object.entries(symbolDict)) {
            symbolCallback(value)
          }

        downloadEndCallback()
    },

    subscribePrice : function(symbol, callback)
    {
        if(!(symbol in symbolDict))
            throw "Invalid symbol"
        if (!(symbol in subscriptionBook))
            subscriptionBook[symbol] = new Set()
        subscriptionBook[symbol].add(callback)
        msg = JSON.stringify({"symbol" : symbol, "action" : "subscribe" })
        producer.send({topic: "price_subscriptions", messages: [{key : symbol, value : msg}],}).then(()=>{}).catch( ex => console.error(`[example/producer] ${ex.message}`, ex))
    },

    unsubscribePrice : function(symbol, callback)
    {
        if (symbol in subscriptionBook)
        {   
            callbacks = subscriptionBook[symbol]
            callbacks.delete(callback)
            if(0 == callbacks.size)
                delete subscriptionBook[symbol]
            msg = JSON.stringify({"symbol" : symbol, "action" : "unsubscribe" })
            producer.send({topic: "price_subscriptions", messages: [{key : symbol, value : msg}],}).then(()=>{}).catch( ex => console.error(`[example/producer] ${ex.message}`, ex))
        }
        else
            throw "Symbol not subscribed"

    },

    start: async function(apiHandleId, clientEntryPointFunction, hosts)
    {   
        kafka = new Kafka({
            clientId: apiHandleId,
            brokers: hosts,
            logLevel: Kafka.ERROR,
            logCreator: WinstonLogCreator
            })
            
        consumer = kafka.consumer({ groupId: 'test' })
        producer = kafka.producer()
        await consumer.connect()
        await producer.connect()
        await consumer.subscribe({ topic: 'prices', fromBeginning: false})
        kafkaReaderLoop = consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => 
            {
                if(0 == topic.localeCompare("prices"))
                    onPriceData(message.value.toString());
            },
        })

        await Promise.all([kafkaReaderLoop, clientEntryPointFunction()])
    }
};