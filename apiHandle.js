const { Kafka } = require('kafkajs')
const winston = require('winston')
const { Console } = require('winston/lib/winston/transports')

subscriptionBook = {}
virtualSubscriptionBook = {}
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
    localSymbol = null
    localSubscriptionBook = null
    dict = JSON.parse(prices)
    if("symbol" in dict)
    {
        localSubscriptionBook = subscriptionBook
        localSymbol = dict["symbol"]
    }
    else
    {
        localSubscriptionBook = virtualSubscriptionBook
        localSymbol = createVirtualTradingPairName(dict["asset"], dict["currency"], dict["bridge"])
    }

    if(localSymbol in localSubscriptionBook)
    {
        callbacks = localSubscriptionBook[localSymbol]
        for(let callback of callbacks)
            callback(dict)
    }
}

function createTradingPairName(asset, currency)
{
    return asset.concat(currency)
}

function createVirtualTradingPairName(asset, currency, bridge)
{
    return asset.concat(currency, bridge)
}


module.exports = {
    downloadAllSymbolsInLump : async function(symbolCallback)
    {
        lump = []
        for (const [key, value] of Object.entries(symbolDict)) {
            lump.push(value)
          }
        
        symbolCallback(lump)
    },

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

    subscribeVirtualPrice : function(asset, currency, bridge, callback)
    {
        symbol1 = createTradingPairName(asset, bridge)
        symbol2 = createTradingPairName(currency, bridge)
        if( symbol1 in symbolDict && symbol2 in symbolDict)
        {
            virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
            if (!(virtualSymbol in virtualSubscriptionBook))
                virtualSubscriptionBook[virtualSymbol] = new Set()
            virtualSubscriptionBook[virtualSymbol].add(callback)
            msg = JSON.stringify({"asset" : asset, "currency" : currency, "bridge" : bridge, "action" : "subscribe" })
            producer.send({topic: "virtual_price_subscriptions", messages: [{key : virtualSymbol, value : msg}],}).then(()=>{}).catch( ex => console.error(`[example/producer] ${ex.message}`, ex))
        }
        else
            throw "One of the parameters is invalid"
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

    unsubscribeVirtualPrice : function(asset, currency, bridge, callback)
    {
        virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
        if (virtualSymbol in virtualSubscriptionBook)
        {   
            callbacks = virtualSubscriptionBook[virtualSymbol]
            callbacks.delete(callback)
            if(0 == callbacks.size)
                delete virtualSubscriptionBook[virtualSymbol]
            msg = JSON.stringify({"asset" : asset, "currency" : currency, "bridge" : bridge, "action" : "unsubscribe" })
            producer.send({topic: "virtual_price_subscriptions", messages: [{key : virtualSymbol, value : msg}],}).then(()=>{}).catch( ex => console.error(`[example/producer] ${ex.message}`, ex))
        }
        else
            throw "Virtual symbol not subscribed"
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
        await consumer.subscribe({ topic: 'virtual_prices', fromBeginning: false})
        kafkaReaderLoop = consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => 
            {
                onPriceData(message.value.toString());
            },
        })

        await Promise.all([kafkaReaderLoop, clientEntryPointFunction()])
    }
};