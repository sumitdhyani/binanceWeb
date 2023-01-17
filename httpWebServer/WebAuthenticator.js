const { Kafka } = require('kafkajs')
const winston = require('winston')
const CommonUtils = require("../CommonUtils")
const appSpecificErrors = require('../appSpecificErrors')
const api = require('../apiHandle')
const process = require('process')
//const { isAsyncFunction } = require('util/types')
//const { setMaxIdleHTTPParsers } = require('http')
const NativeLoglevel = api.Loglevel
const WebserverEvents= api.WebserverEvents
feedServerBook = new Map()
let producer = null
let logger = null

function stringToAPILogLevel(level){
    if(level.toUpperCase() === "ERROR"){
        return api.Loglevel.ERROR
    }
    else if(level.toUpperCase() === "WARN"){
        return api.Loglevel.WARN
    }
    else if(level.toUpperCase() === "INFO"){
        return api.Loglevel.INFO
    }
    else if(level.toUpperCase() === "DEBUG"){
        return api.Loglevel.DEBUG
    }
    else{
        return api.Loglevel.INFO
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


const broker = process.argv[2] 
const listenPort = parseInt(process.argv[3])
const appName = process.argv[4]
let logLevel = api.Loglevel.INFO
if(undefined !== process.argv[5]){
    logLevel = stringToAPILogLevel(process.argv[5])
}
feedServerBook = new Map()

function onWebserverEvt(dict){
    evt = dict["evt"]
    if(0 == evt.localeCompare(WebserverEvents.NewConnection.description) ||
       0 == evt.localeCompare(WebserverEvents.Disconnection.description)){
        appName = dict["appId"]
        numConnections = dict["numClientConnections"]
        if(feedServerBook.has(appName))
        {   
            (feedServerBook[appName])[0]++;
            logger.info(`${evt} received for app: ${appName}, numconnections: ${numConnections}`)
        }
        else{
            logger.info(`${evt} received for unregistereed app : ${appName}`)
        }
    }
}

function onAdminEvent(dict){
    evt = dict["evt"]
    appName = dict["appId"]
    appGroup = dict["FeedServer"]

    if(appGroup != "FeedServer"){
        return
    }

    if(0 == evt.localeCompare("app_up")){
        if(!feedServerBook.has(appName)){
            feedServerBook.set(appName, 0)
            logger.info(`app_up received for app: ${appName}`)
        }
        else{
            logger.warn(`app_up received for existing app: ${appName}`)
        }
    }
    else if(0 == evt.localeCompare("app_down")){
        if(!feedServerBook.delete(appName)){
            logger.warn(`app_down received for non-existent app: ${appName}`)
        }
        else{
            logger.info(`app_down received for app: ${appName}`)
        }
    }
}

async function onAdminQueryResponse(dict){
    results = dict["results"]

    for(const result of results){
        appName = result["appId"] 
        if(!feedServerBook.has(appName)){
            feedServerBook.set(appName, [0, dict])
            logger.info(`adminQuery resopnse received for app: ${appName}`)
        }

        await sendWebserverQuery(appName)

    }
}

async function onWebserverQueryResponse(dict){
    appName = result["appId"] 
    logger.info(`WebserverQuery resopnse received for app: ${appName}`)
    (feedServerBook[appId])[0] = dict["numClientConnections"]
}

const AdminEvents = {
    Registration: Symbol("Registration"),
    HeartBeat: Symbol("HeartBeat")
}

function getJsonStringForHeartbeat()
{
    dict = {evt : AdminEvents.HeartBeat.description, appId : appName}
    return JSON.stringify(dict)
}

function getJsonStringForRegistration()
{
    dict = {appId : appName, appGroup : "FeedServer"}
    return JSON.stringify(dict)
}

async function sendAdminEvent(event){
    switch(event){
        case AdminEvents.HeartBeat:
            await producer.send({ topic: "heartbeats", messages: [{ key: appName, value: getJsonStringForHeartbeat() }] })
            break
        case AdminEvents.Registration:
            await producer.send({ topic: "registrations", messages: [{ key: appName, value: getJsonStringForRegistration() }] })
            break
    }
}

async function sendAdminQuery(){
    dict = {destination_topic : appName, eq : {appGroup : "FeedServer"}}
    await producer.send({ topic: "admin_queries", messages: [{ key: appName, value: JSON.stringify(dict) }] })
}

async function sendWebserverQuery(topic){
    dict = {destination_topic : appName, message_type : "component_enquiry"}
    await producer.send({ topic: topic, messages: [{ key: appName, value: JSON.stringify(dict) }] })
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

async function run() {
    console.log(`Started WebAuthenticator, appId: ${appName}`)
    const date = new Date()
    const timeSuffix =  date.getFullYear().toString() + "-" +
                        (date.getMonth() + 1).toString().padStart(2, '0') + "-" +
                        date.getDate().toString().padStart(2, '0')
    const appFileName = appName + "_" + timeSuffix + ".log"
    const kafkFileName = "Kafka_" + appFileName

    kafka = new Kafka({
        clientId: appName,
        brokers: [broker],
        logLevel: enumToKafkaLogLevel(logLevel),
        logCreator: (logLevel) => {
            return WinstonLogCreator(logLevel, "Logs/" + kafkFileName)
        }
    })

    const admin = kafka.admin()
    consumer = kafka.consumer({ groupId: appName })
    producer = kafka.producer()
    await admin.connect()
    await consumer.connect()
    await producer.connect()

    //Create the inbound topic for this service
    await admin.createTopics({
        topics: [{ topic: appName, replicationFactor: 1, numPartitions: 1 }]
    })

    await consumer.subscribe({ topic: 'webserver_events', fromBeginning: false })
    await consumer.subscribe({ topic: 'admin_events', fromBeginning: false })
    logger = CommonUtils.createFileLogger("Logs/" + appFileName, enumToWinstomLogLevel(logLevel))
    await sendAdminEvent(AdminEvents.Registration)

    await consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => {
                const raw = message.value.toString()
                const dict = JSON.parse(raw)
                logger.info(`Data recieved: ${JSON.stringify(dict)}`)
                console.log(`Data recieved: ${JSON.stringify(dict)}`)
                
                if(topic == "admin_events"){
                    console.log(`admin_events recieved: ${JSON.stringify(dict)}`)
                    onAdminEvent(dict)
                }
                else if(topic == "webserver_events"){
                    console.log(`webserver_events recieved: ${JSON.stringify(dict)}`)
                    onWebserverEvt(dict)
                }
                else if(topic == appName){
                    console.log(`${appName} recieved: ${JSON.stringify(dict)}`)
                    messageType = dict["message_type"]
                    if("admin_query_response" == messageType){
                        await onAdminQueryResponse(dict)
                    }
                    else if("webserver_query_response" == messageType){
                        await onWebserverQueryResponse(dict)
                    }
                }
            },
        })
    
    setInterval(()=>{
        sendAdminEvent(AdminEvents.HeartBeat).then(()=>{}).catch((err)=>{
            console.log(`Error while sending HeartBeat event, details: ${err.message}`)
        })
    }, 5000)

    await sendAdminQuery()
}

run().then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}`)
})