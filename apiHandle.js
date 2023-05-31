const { Kafka } = require('kafkajs')
const winston = require('winston')
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("./CommonUtils")
const appSpecificErrors = require('./IndependentCommonUtils/appSpecificErrors');
const process = require('process')
const env = process.env

let port = 0
const subscriptionBook = new Map()
const virtualSubscriptionBook = new Map()
let producer = null
let symbolDict = new Map()
let logger = null
let numClientConnections  = 0
const createTradingPairName = CommonUtils.createTradingPairName
const createVirtualTradingPairName = CommonUtils.createVirtualTradingPairName
const disintegrateVirtualTradingPairName = CommonUtils.disintegrateVirtualTradingPairName
let appId = null

const NativeLoglevel = {
    ERROR: Symbol("ERROR"),
    WARN: Symbol("WARN"),
    INFO: Symbol("INFO"),
    DEBUG: Symbol("DEBUG")
}

const AdminEvents = {
    Registration: Symbol("Registration"),
    HeartBeat: Symbol("HeartBeat")
}

const WebserverEvents = {
    NewConnection: Symbol("NewConnection"),
    Disconnection: Symbol("Disconnection")
}


const KafkatoWinstonLogLevel = level => {
    switch (level) {
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
            return 'info'
    }
}

function enumToWinstomLogLevel(level) {
    switch (level) {
        case NativeLoglevel.ERROR:
            return 'error'
        case NativeLoglevel.WARN:
            return 'warn'
        case NativeLoglevel.INFO:
            return 'info'
        case NativeLoglevel.DEBUG:
            return 'debug'
        default:
            return 'info'
    }
}

function enumToKafkaLogLevel(level) {
    switch (level) {
        case NativeLoglevel.ERROR:
            return Kafka.ERROR
        case NativeLoglevel.WARN:
            return Kafka.WARN
        case NativeLoglevel.INFO:
            return Kafka.INFO
        case NativeLoglevel.DEBUG:
            return Kafka.DEBUG
        default:
            return Kafka.INFO
    }
}

const WinstonLogCreator = (logLevel, fileName) => {
    const logger = winston.createLogger({
        level: KafkatoWinstonLogLevel(logLevel),
        transports: [
            new winston.transports.File({ filename: fileName })
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

function onNormalPriceData(dict, raw, headers) {
    const key = JSON.stringify([dict["symbol"], dict["exchange"]])
    headers[Object.keys(headers).length] = Date.now()
    dict["timestamps"] = headers
    const callback = subscriptionBook.get(key)
    if (undefined !== callback) {
        callback(JSON.stringify(dict))
    }
}

function onVirtualPriceData(dict, raw){
    symbol = createVirtualTradingPairName(dict["asset"], dict["currency"], dict["bridge"])
    const callback = virtualSubscriptionBook.get(symbol)
    if (undefined !== callback) {
        callback(raw)
    }
}


async function loadSymbols() {
    const fileStream = fs.createReadStream('symbols.txt');
    logger.warn(`loading symbols`)

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        dict = JSON.parse(line)
        const desc = dict["baseAsset"] + " vs " + dict["quoteAsset"]
        dict["description"] = desc
        const key =  JSON.stringify([dict["symbol"], "BINANCE"])
        symbolDict[key] = dict
    }
}


async function cancelAllSubscriptions() {
    for (let [symbol, exchange] of subscriptionBook.keys()) {
        msg = JSON.stringify({ symbol: symbol, exchange : exchange, action : "unsubscribe" })
        await producer.send({ topic: "price_subscriptions", messages: [{ key: symbol, value: msg }] })
    }

    for (let virtualSymbol of virtualSubscriptionBook.keys()) {
        const { asset, currency, bridge } = disintegrateVirtualTradingPairName(virtualSymbol)
        msg = JSON.stringify({ "asset": asset, "currency": currency, "bridge": bridge, "action": "subscribe" })
        await producer.send({ topic: "virtual_price_subscriptions", messages: [{ key: virtualSymbol, value: msg }] })
    }

    subscriptionBook.clear()
    virtualSubscriptionBook.clear()
}

async function enqueueSubscriptionRequest(dict, topic, key)
{
    dict["destination_topic"] = appId
    msg = JSON.stringify(dict)
    await producer.send({ topic: topic, messages: [{ key: key, value: msg }] })
}

function getJsonStringForNewConnection()
{
    dict = {evt : WebserverEvents.NewConnection.description, appId : appId, numClientConnections : ++numClientConnections}
    return JSON.stringify(dict)
}

function getJsonStringForDisconnection()
{
    dict = {evt : WebserverEvents.Disconnection.description, appId : appId, numClientConnections : --numClientConnections}
    return JSON.stringify(dict)
}

function getJsonStringForHeartbeat()
{
    dict = {evt : AdminEvents.HeartBeat.description, appId : appId}
    return JSON.stringify(dict)
}

function getJsonStringForRegistration()
{
    dict = {appId : appId, appGroup : "FeedServer", hostPort : env.LOCALIP + ":" + port}
    return JSON.stringify(dict)
}

function getObjectForComponentInfo(){
    return {appId : appId, appGroup : "FeedServer", hostPort : env.LOCALIP + ":" + port, numClientConnections : numClientConnections}
}

function getJsonStringForComponentInfo(){
    return JSON.stringify(getObjectForComponentInfo())
}

async function sendWebserverEvent(event)
{
    switch(event){
        case WebserverEvents.NewConnection:
            await producer.send({ topic: "webserver_events", messages: [{ key: appId, value: getJsonStringForNewConnection() }] })
            break
        case WebserverEvents.Disconnection:
            await producer.send({ topic: "webserver_events", messages: [{ key: appId, value: getJsonStringForDisconnection() }] })
            break
    }
}

async function sendAdminEvent(event){
    switch(event){
        case AdminEvents.HeartBeat:
            await producer.send({ topic: "heartbeats", messages: [{ key: appId, value: getJsonStringForHeartbeat() }] })
            break
        case AdminEvents.Registration:
            await producer.send({ topic: "registrations", messages: [{ key: appId, value: getJsonStringForRegistration() }] })
            break
    }
}

async function sendComponentInfo(destTopic){
    await producer.send({ topic: destTopic, messages: [{ key: appId, value: JSON.stringify({...getObjectForComponentInfo(), message_type : "webserver_query_response"})}] })
}

async function onComponentEnquiry(dict){
    logger.warn(`Component inquiry received, dest topic: ${dict["destination_topic"]}`)
    await sendComponentInfo(dict["destination_topic"])
}

module.exports = {
    downloadAllSymbolsInLump: async function (symbolCallback) {
        lump = []
        for (const [key, value] of Object.entries(symbolDict)) {
            lump.push(value)
        }

        symbolCallback(lump)
    },

    downloadAllSymbols: async function (symbolCallback, downloadEndCallback) {
        for (const [key, value] of Object.entries(symbolDict)) {
            symbolCallback(value)
        }

        downloadEndCallback()
    },

    subscribePrice: async function (symbol, exchange, callback) {
        const key = JSON.stringify([symbol, exchange])
        if (undefined === symbolDict[key]) {
            throw new appSpecificErrors.InvalidSymbol(`Invalid instrument, symbol: ${key}`)
        }
        else if (undefined !== subscriptionBook[key]) {
            throw new appSpecificErrors.DuplicateSubscription()
        }
        else {
            subscriptionBook.set(key, callback)
            obj = { symbol : symbol, exchange : exchange, action : "subscribe"}
            await enqueueSubscriptionRequest(obj, "price_subscriptions", JSON.stringify([symbol, exchange]))
            logger.info(`Forwarded subsccription for: ${key}, futher in the pipeline`)
        }
    },

    subscribeVirtualPrice: async function (asset, currency, bridge, callback) {
        symbol1 = createTradingPairName(asset, bridge)
        symbol2 = createTradingPairName(currency, bridge)
        if (!(symbolDict.has(symbol1) && symbolDict.has(symbol2))) {
            throw new appSpecificErrors.InvalidSymbol("One of the params is not a proper asset")
        }
        else {
            virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
            if (virtualSubscriptionBook.has(virtualSymbol)) {
                throw new appSpecificErrors.DuplicateSubscription()
            }
            else {
                virtualSubscriptionBook.set(virtualSymbol, callback)
                obj = { asset: asset, currency: currency, bridge: bridge, action: "subscribe" }
                await enqueueSubscriptionRequest(obj, "virtual_price_subscriptions", virtualSymbol)
            }
        }
    },

    unsubscribePrice: async function (symbol, exchange) {
        const key = JSON.stringify([symbol, exchange])
        if (!subscriptionBook.delete(key)) {
            throw new appSpecificErrors.SpuriousUnsubscription()
        }
        else {
            obj = { symbol: symbol, exchange : exchange, action: "unsubscribe" }
            await enqueueSubscriptionRequest(obj, "price_subscriptions", JSON.stringify([symbol, exchange]))
            logger.info(`Forwarded unsubsccription for: ${key}, futher in the pipeline`)
        }
    },

    unsubscribeVirtualPrice: async function (asset, currency, bridge) {
        virtualSymbol = createVirtualTradingPairName(asset, currency, bridge)
        if (!virtualSubscriptionBook.delete(virtualSymbol)) {
            throw new appSpecificErrors.SpuriousUnsubscription()
        }
        else {
            obj = {asset: asset, currency: currency, bridge : bridge, action: "unsubscribe" }
            await enqueueSubscriptionRequest(obj, "virtual_price_subscriptions", virtualSymbol)
        }
    },

    start: async function (apiHandleId, clientEntryPointFunction, hosts, applId, listenPort, logLevel) {
        port = listenPort.toString()
        appId = applId
        const date = new Date()
        const timeSuffix =  date.getFullYear().toString() + "-" +
                            (date.getMonth() + 1).toString().padStart(2, '0') + "-" +
                            date.getDate().toString().padStart(2, '0')
        const appFileName = applId + "_" + timeSuffix + ".log"
        const kafkFileName = "Kafka_" + appFileName

        logger = CommonUtils.createFileLogger("Logs/" + appFileName, enumToWinstomLogLevel(logLevel))
        //logger = {debug : msg=>console.log(msg),
        //          info : msg=>console.log(msg),
        //          warn : msg=>console.log(msg),
        //          error : msg=>console.log(msg)}

        await loadSymbols()
        kafka = new Kafka({
            clientId: apiHandleId,
            brokers: hosts,
            logLevel: enumToKafkaLogLevel(logLevel),
            logCreator: (logLevel) => {
                return WinstonLogCreator(logLevel, "Logs/" + kafkFileName)
            }
        })

        const admin = kafka.admin()
        consumer = kafka.consumer({ groupId: applId })
        producer = kafka.producer()
        await admin.connect()
        await consumer.connect()
        await producer.connect()

        //Create the inbound topic for this service
        await admin.createTopics({
            topics: [{ topic: applId, replicationFactor: 1, numPartitions: 1 }]
        })

        await consumer.subscribe({ topic: applId, fromBeginning: false })

        await sendAdminEvent(AdminEvents.Registration)
        setInterval(()=>{
            sendAdminEvent(AdminEvents.HeartBeat).then(()=>{}).catch((err)=>{
                console.log(`Error while sending HeartBeat event, details: ${err.message}`)
            })
        }, 5000)

        kafkaReaderLoop = consumer.run(
            {
                eachMessage: async ({ topic, partition, message }) => {
                    try{
                        const recvTime = Date.now()
                        let headers = message.headers
                        const keys =  Object.keys(headers)
                        keys.forEach( key=>{
                            headers[key] = parseInt(headers[key])
                        })
                        const numKeys = keys.length
                        headers[numKeys] = parseInt(message.timestamp)
                        headers[numKeys+1] = recvTime

                        const raw = message.value.toString()
                        const dict = JSON.parse(raw)
                        const messageType = dict.message_type
                        
                        if("depth" === messageType){    
                            onNormalPriceData(dict, raw, headers)
                        }
                        else if("virtual_depth" == messageType){
                            onVirtualPriceData(dict, raw)
                        }
                        else if("component_enquiry" === messageType){
                            await onComponentEnquiry(dict)
                        }
                    }catch(err){
                        logger.warn(`Error in reader loop: ${err.message}`)
                    }
                },
            })
        await Promise.all([kafkaReaderLoop, clientEntryPointFunction(logger)])
    },

    Loglevel: NativeLoglevel,

    sendWebserverEvent : sendWebserverEvent,

    WebserverEvents : WebserverEvents
};