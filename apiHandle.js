const { Kafka } = require('kafkajs')
const winston = require('winston')
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("./CommonUtils")
const appSpecificErrors = require('./IndependentCommonUtils/appSpecificErrors');
const process = require('process');
const { type } = require('os');
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
        callback(dict, JSON.stringify(dict))
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
        let key =  JSON.stringify([dict["symbol"], "BINANCE"])
        symbolDict[key] = dict

        key =  JSON.stringify([dict["symbol"], "FAKEX"])
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
    const componentInfo = {...getObjectForComponentInfo(), message_type : "webserver_query_response"}
    const valueToBeSent = JSON.stringify(componentInfo)
    logger.info(`Sending component info to topic ${destTopic}: ${valueToBeSent}`)
    await producer.send({ topic: destTopic, messages: [{ key: appId, value: valueToBeSent}] })
    logger.info(`Sent component info`)
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

    subscribePrice: async function (symbol, exchange, type, callback) {
        const instrumentKey = JSON.stringify([symbol, exchange])
        const subscriptionKey = JSON.stringify([symbol, exchange, type])
        if (undefined === symbolDict[instrumentKey]) {
            throw new appSpecificErrors.InvalidSymbol(`Invalid instrument, symbol: ${subscriptionKey}`)
        }
        else if (undefined !== subscriptionBook[subscriptionKey]) {
            throw new appSpecificErrors.DuplicateSubscription()
        }
        else {
            subscriptionBook.set(subscriptionKey, callback)
            obj = { symbol : symbol, exchange : exchange, type : type, action : "subscribe"}
            await enqueueSubscriptionRequest(obj, "price_subscriptions", JSON.stringify([symbol, exchange]))
            logger.info(`Forwarded subsccription for: ${subscriptionKey}, futher in the pipeline`)
        }
    },

    unsubscribePrice: async function (symbol, exchange, type) {
        const key = JSON.stringify([symbol, exchange, type])
        if (!subscriptionBook.delete(key)) {
            throw new appSpecificErrors.SpuriousUnsubscription()
        }
        else {
            obj = { symbol: symbol, exchange : exchange, type : type, action: "unsubscribe" }
            await enqueueSubscriptionRequest(obj, "price_subscriptions", JSON.stringify([symbol, exchange]))
            logger.info(`Forwarded unsubsccription for: ${key}, futher in the pipeline`)
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

        const seekOffset = async (admin, groupId, topic, partition) => {
            const offsets = await admin.fetchOffsets({ groupId, topic })
            logger.info(`Group info: ${JSON.stringify(offsets)}`)
            return offsets.reduce((prev, curr) => curr.partition === partition? curr.offset : prev, -1)
        };

        try {
            logger = CommonUtils.createFileLogger("Logs/" + appFileName, enumToWinstomLogLevel(logLevel))
            //logger = {debug : msg=>console.log(msg),
            //          info : msg=>console.log(msg),
            //          warn : msg=>console.log(msg),
            //          error : msg=>console.log(msg)}

            await loadSymbols()
            const kafkaHandle = new Kafka({
                clientId: apiHandleId,
                brokers: hosts,
                logLevel: enumToKafkaLogLevel(logLevel),
                logCreator: (logLevel) => {
                    return WinstonLogCreator(logLevel, "Logs/" + kafkFileName)
                }
            })

            const admin = kafkaHandle.admin()
            const consumer = kafkaHandle.consumer({ groupId: appId, enableAutoCommit: false })
            producer = kafkaHandle.producer()
            await admin.connect()
            await consumer.connect()
            await producer.connect()

            //Create the inbound topic for this service
            await admin.createTopics({
                topics: [{ topic: applId, replicationFactor: 1, numPartitions: 1 }]
            })

            await sendAdminEvent(AdminEvents.Registration)

            const currentOffset = await seekOffset(admin, applId, applId, 0)
            if (-1 == currentOffset || undefined === currentOffset) {
                logger.warn(`Current offset for topic ${applId} is -1, so setting fromBeginning: true`)
                await consumer.subscribe({ topic: applId, fromBeginning: true })
            } else {
                logger.info(`Current offset for topic ${applId} is ${currentOffset}`)
                await consumer.subscribe({ topic: applId, fromBeginning: false })
            }
            setInterval(()=>{
                sendAdminEvent(AdminEvents.HeartBeat).then(()=>{}).catch((err)=>{
                    console.log(`Error while sending HeartBeat event, details: ${err.message}`)
                })
            }, 5000)
        

            kafkaReaderLoop = consumer.run( {
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
                        logger.debug(`Data received: ${raw}`)
                        const dict = JSON.parse(raw)
                        const messageType = dict.message_type

                        if("depth" === messageType){    
                            onNormalPriceData(dict, raw, headers)
                        } else if("component_enquiry" === messageType){
                            await onComponentEnquiry(dict)
                        }

                    } catch(err){
	            	    logger.warn(`Got error while processsing {topic:partition:offset}: ${topic}:${partition}:${message.offset+1}, details: ${err.message}`)
                    } finally {
	            	await consumer.commitOffsets([{ topic, partition, offset: message.offset + 1 }])
	            }
                },
            })
            await Promise.all([kafkaReaderLoop, clientEntryPointFunction(logger)])
        } catch(err) {
            logger.warn(`Error in initial phase, details: ${err.message}, stack: ${err.stack}`)
        }
    },

    Loglevel: NativeLoglevel,

    sendWebserverEvent : sendWebserverEvent,

    WebserverEvents : WebserverEvents
};
