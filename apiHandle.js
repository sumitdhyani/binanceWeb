const { Kafka } = require('kafkajs')
const winston = require('winston')
const { Console } = require('winston/lib/winston/transports')
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("./CommonUtils")
const appSpecificErrors = require('./appSpecificErrors')

subscriptionBook = new Map()
virtualSubscriptionBook = new Map()
producer = null
symbolDict = new Map()
let logger = null
const createTradingPairName = CommonUtils.createTradingPairName
const createVirtualTradingPairName = CommonUtils.createVirtualTradingPairName
const disintegrateVirtualTradingPairName = CommonUtils.disintegrateVirtualTradingPairName

const NativeLoglevel = {
    ERROR : Symbol("ERROR"),
    WARN : Symbol("WARN"),
    INFO : Symbol("INFO"),
    DEBUG : Symbol("DEBUG")
}

const KafkatoWinstonLogLevel = level => {switch(level) {
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

function enumToWinstomLogLevel(level)
{
    switch(level) {
        case NativeLoglevel.ERROR:
            return 'error'
        case NativeLoglevel.WARN:
            return 'warn'
        case NativeLoglevel.INFO:
            return 'info'
        case NativeLoglevel.DEBUG:
            return 'debug'
        default:
            return 'debug'
    }
}

const WinstonLogCreator = (logLevel, fileName) => {
    const logger = winston.createLogger({
        level: KafkatoWinstonLogLevel(logLevel),
        transports: [
            new winston.transports.File({ filename : fileName })
        ]
    })

    return ({ namespace, level, label, log }) => {
        const { message, ...extra } = log
        logger.log({
            level: KafkatoWinstonLogLevel(level),
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
    if(!("bridge" in dict))
    {
        localSubscriptionBook = subscriptionBook
        localSymbol = dict["symbol"]
    }
    else
    {
        localSubscriptionBook = virtualSubscriptionBook
        localSymbol = createVirtualTradingPairName(dict["asset"], dict["currency"], dict["bridge"])
    }

    const callback = localSubscriptionBook.get(localSymbol)
    if(undefined !== callback){
            callback(dict)
    }
}



async function loadSymbols() {
    const fileStream = fs.createReadStream('symbols.txt');
  
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl)
    {
      dict = JSON.parse(line)
      const desc = dict["baseAsset"] + " vs " + dict["quoteAsset"]
      dict["description"] = desc
      symbol = dict["symbol"]
      symbolDict.set(symbol, dict)
    }
  }


async function cancelAllSubscriptions(){
    for(let symbol of subscriptionBook.keys()){
        msg = JSON.stringify({"symbol" : symbol, "action" : "unsubscribe" })
        await producer.send({topic: "price_subscriptions", messages: [{key : symbol, value : msg}]})
    }

    for(let virtualSymbol of virtualSubscriptionBook.keys()){
        const {asset, currency, bridge} = disintegrateVirtualTradingPairName(virtualSymbol)
        msg = JSON.stringify({"asset" : asset, "currency" : currency, "bridge" : bridge, "action" : "subscribe" })
        await producer.send({topic: "virtual_price_subscriptions", messages: [{key : virtualSymbol, value : msg}]})        
    }

    subscriptionBook.clear()
    virtualSubscriptionBook.clear()
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

    subscribePrice : async function(symbol, callback)
    {
        if(!(symbolDict.has(symbol))){
            throw new appSpecificErrors.InvalidSymbol(`Invalid symbol: ${symbol}`)
        }
        else if(subscriptionBook.has(symbol)){
            throw new appSpecificErrors.DuplicateSubscription()
        }
        else{
            subscriptionBook.set(symbol, callback)
            msg = JSON.stringify({"symbol" : symbol, "action" : "subscribe" })
            await producer.send({topic: "price_subscriptions", messages: [{key : symbol, value : msg}]})
        }
    },

    subscribeVirtualPrice : async function(asset, currency, bridge, callback)
    {
        symbol1 = createTradingPairName(asset, bridge)
        symbol2 = createTradingPairName(currency, bridge)
        if(!(symbolDict.has(symbol1) && symbolDict.has(symbol2))){
            throw new appSpecificErrors.InvalidSymbol("One of the params is not a proper asset")
        }
        else{
            virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
            if(virtualSubscriptionBook.has(virtualSymbol)){
                throw new appSpecificErrors.DuplicateSubscription()
            }
            else{
                virtualSubscriptionBook.set(virtualSymbol, callback)
                msg = JSON.stringify({"asset" : asset, "currency" : currency, "bridge" : bridge, "action" : "subscribe" })
                await producer.send({topic: "virtual_price_subscriptions", messages: [{key : virtualSymbol, value : msg}]})
            }
        }
    },

    unsubscribePrice : async function(symbol)
    {
        if(!subscriptionBook.delete(symbol)){
            throw new appSpecificErrors.SpuriousUnsubscription()
        }
        else{
            msg = JSON.stringify({"symbol" : symbol, "action" : "unsubscribe" })
            await producer.send({topic: "price_subscriptions", messages: [{key : symbol, value : msg}]})
        }
    },

    unsubscribeVirtualPrice : async function(asset, currency, bridge)
    {
        virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
        if(!virtualSubscriptionBook.delete(virtualSymbol)){
            throw new appSpecificErrors.SpuriousUnsubscription()
        }
        else{
            msg = JSON.stringify({"asset" : asset, "currency" : currency, "bridge" : bridge, "action" : "unsubscribe" })
            await producer.send({topic: "virtual_price_subscriptions", messages: [{key : virtualSymbol, value : msg}]})
        }
    },

    start: async function(apiHandleId, clientEntryPointFunction, hosts, appId, logLevel)
    {   
        await loadSymbols()
        kafka = new Kafka({
            clientId: apiHandleId,
            brokers: hosts,
            logLevel: Kafka.ERROR,
            logCreator: (logLevel) => {
                return WinstonLogCreator(logLevel, "kafka.log")
            }
            })
            
        consumer = kafka.consumer({ groupId: appId })
        producer = kafka.producer()
        await consumer.connect()
        await producer.connect()
        await consumer.subscribe({ topic: 'prices', fromBeginning: false})
        await consumer.subscribe({ topic: 'virtual_prices', fromBeginning: false})
        logger = CommonUtils.createFileLogger(appId + ".log", enumToWinstomLogLevel(logLevel))
        kafkaReaderLoop = consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => 
            {
                onPriceData(message.value.toString())
            },
        })

        await Promise.all([kafkaReaderLoop, clientEntryPointFunction(logger)])
    },

    Loglevel : NativeLoglevel,
};