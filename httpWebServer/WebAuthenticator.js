const { Kafka } = require('kafkajs')
const winston = require('winston')
const CommonUtils = require("../CommonUtils")
const api = require('../apiHandle')
const process = require('process')
const express = require('express')
const constants = require('../ClientLayerLibrary/Constants').constants
const app = express()
const cors = require('cors')
app.use(cors({
    origin: '*'
}))
const httpHandle = require('http')
const NativeLoglevel = api.Loglevel
const WebserverEvents= api.WebserverEvents

//Key: appId of feedServer,
//Value: array of 2 elements [0] = no. of clients connected currently, [1] = all the other details of the feed_server
const feedServerBook = new Map()
let producer = null
let logger = null
const httpServer = httpHandle.createServer(app)

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


const brokers = process.argv[2].split(",")
const listenPort = parseInt(process.argv[3])
const appId = process.argv[4]
let logLevel = api.Loglevel.INFO
if(undefined !== process.argv[5]){
    logLevel = stringToAPILogLevel(process.argv[5])
}

async function onWebserverEvt(dict){
    await sendWebserverQuery(dict.appId)
}

async function onAdminEvent(dict){
    const evt = dict.evt
    const appName = dict.appId
    const appGroup = dict.appGroup

    if (undefined === appGroup) {
        return
    }

    if(0 !== appGroup.localeCompare("FeedServer") &&
       0 !== appGroup.localeCompare("admin_data_provider"))
    {
        return
    }


    if (0 === evt.localeCompare("app_up")) {
        logger.info(`app_up received for ${appName}, group: ${appGroup}, sending subscription requests for webservers`)
        if (0 === appGroup.localeCompare("admin_data_provider")) {
            sendAdminQuery(appName)
        }
    }
    else if(0 === evt.localeCompare("app_down")){
        if(!feedServerBook.delete(appName)){
            logger.warn(`app_down received for non-existent app: ${appName}`)
        }
        else{
            logger.info(`app_down received for app: ${appName}`)
        }
    }
}

async function onAdminQueryResponse(responseDict){
    const dict = responseDict.component
    logger.info(`Admin Update received for app: ${JSON.stringify(dict)}, appId: ${dict["appId"]}, appGroup: ${dict.appGroup}`)
    //logger.info(`WebserverQuery response received for app: ${dict.appId}`)
    if (!feedServerBook.has(dict.appId)) {
        feedServerBook.set(dict.appId, [dict.numClientConnections, dict])
    } else {
        logger.info(`Admin Update ignored for app: ${dict["appId"]} as it's already in the book`)
    }
}

async function onWebServerEnquiryResponse(dict) {
    logger.info(`component_enquiry_response received for app: ${dict["appId"]}, appGroup: ${dict.appGroup}`)
    //logger.info(`WebserverQuery response received for app: ${dict.appId}`)
    feedServerBook.set(dict.appId, [dict.numClientConnections, dict])
}

function getObjectForComponentInfo(){
    return {appId : appId, appGroup : "web_auth"}
}

async function sendComponentInfo(destTopic){
    const componentInfo = {...getObjectForComponentInfo(), message_type : "component_enquiry_response"}
    const valueToBeSent = JSON.stringify(componentInfo)
    logger.info(`Sending component info to topic ${destTopic}: ${valueToBeSent}`)
    await producer.send({ topic: destTopic, messages: [{ key: appId, value: valueToBeSent}] })
    logger.info(`Sent component info`)
}

async function onComponentEnquiry(dict) {
    logger.warn(`Component inquiry received, dest topic: ${dict["destination_topic"]}`)
    await sendComponentInfo(dict["destination_topic"])
}


async function onWebserverQueryResponse(dict){
    logger.info(`WebserverQuery resopnse received for app: ${dict.appId}`)
    feedServerBook.set(dict["appId"], [dict.numClientConnections, dict])
}

const AdminEvents = {
    Registration: Symbol("Registration"),
    HeartBeat: Symbol("HeartBeat")
}

function getJsonStringForHeartbeat()
{
    dict = {evt : AdminEvents.HeartBeat.description, appId : appId}
    return JSON.stringify(dict)
}

function getJsonStringForRegistration()
{
    dict = {appId : appId, appGroup : "web_auth"}
    return JSON.stringify(dict)
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

async function sendAdminQuery(targetTopic){
    dict = {destination_topic : appId, message_type : "component_subscription", eq : {appGroup : "FeedServer"}}
    await producer.send({ topic: undefined === targetTopic? "admin_subscriptions" : targetTopic, messages: [{ key: appId, value: JSON.stringify(dict) }] })
}

async function sendWebserverQuery(topic){
    logger.info(`Sending component inquiry for ${topic}`)
    dict = {destination_topic : appId, message_type : "component_enquiry"}
    await producer.send({ topic: topic, messages: [{ key: appId, value: JSON.stringify(dict) }] })
    logger.info(`Sent component inquiry for ${topic}`)
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

function launchHttpCommunicationEngine(app, apiLogger)
{
    logger = apiLogger
    app.get('/', (req, res) =>{
        res.send("Hello World!");
    });

    app.get('/api', (req, res) =>{
        res.send("Welcome to api page!");
    });

    app.get('/auth/:json', (req, res) =>{
        let lowest = Number.MAX_SAFE_INTEGER
        let currServer = null
        feedServerBook.forEach((value, key) => {
            if(value[0] < lowest){
                lowest = value[0]
                currServer = value[1]
            }
        });
        if(lowest != Number.MAX_SAFE_INTEGER){
            logger.info(JSON.stringify(feedServerBook))
            logger.info(`On http request, returning the server: ${JSON.stringify(currServer)}`)
            res.send({success : true, 
                      feed_server : currServer["appId"]})
        }
        else{
            res.send({success : false,
                      code : constants.error_codes.no_feed_server,
                      reason : `No feedserver found`})
            logger.warn(`No feedserver found`)
        }
    });

    app.get('/api/serveraddr', (req, res) =>{
        lowest = -1
        currServer = null
        feedServerBook.forEach((value, key) => {
            if(value[0] > lowest){
                lowest = value[0]
                currServer = value[1]
            }
        });
        console.log(JSON.stringify(feedServerBook))
        console.log(currServer)
        res.send(currServer)
    });

    app.get('/api/sort/:arr', (req, res) =>{
        names = req.params.arr.split(",");
        names.sort()
        res.send(String(names));
    });
}

async function run() {
    console.log(`Started WebAuthenticator, appId: ${appId}`)
    const date = new Date()
    const timeSuffix =  date.getFullYear().toString() + "-" +
                        (date.getMonth() + 1).toString().padStart(2, '0') + "-" +
                        date.getDate().toString().padStart(2, '0')
    const appFileName = appId + "_" + timeSuffix + ".log"
    const kafkFileName = "Kafka_" + appFileName

    kafka = new Kafka({
        clientId: appId,
        brokers: brokers,
        logLevel: enumToKafkaLogLevel(logLevel),
        logCreator: (logLevel) => {
            return WinstonLogCreator(logLevel, "Logs/" + kafkFileName)
        }
    })

    const admin = kafka.admin()
    consumer = kafka.consumer({ groupId: appId, enableAutoCommit: false, fromBeginning: false })
    producer = kafka.producer()
    await admin.connect()
    await consumer.connect()
    await producer.connect()

    //Create the inbound topic for this service
    try {
        await admin.createTopics({
            topics: [{ topic: appId, replicationFactor: 2, numPartitions: 1 }]
        })
    } catch(error) {}

    await consumer.subscribe({ topic: 'webserver_events', fromBeginning: false })
    await consumer.subscribe({ topic: 'admin_events', fromBeginning: false })
    await consumer.subscribe({ topic: appId, fromBeginning: false })
    logger = CommonUtils.createFileLogger("Logs/" + appFileName, enumToWinstomLogLevel(logLevel))
    await sendAdminEvent(AdminEvents.Registration)

    await consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => {
		try {
                    const raw = message.value.toString()
                    const dict = JSON.parse(raw)
                    
                    if (0 === topic.localeCompare("admin_events")) {
                        logger.info(`admin_events recieved: ${JSON.stringify(dict)}`)
                        await onAdminEvent(dict)
                    }
                    else if (0 === topic.localeCompare("webserver_events")) {
                        logger.info(`webserver_events recieved: ${JSON.stringify(dict)}`)
                        await onWebserverEvt(dict)
                    }
                    
                    else if (0 === topic.localeCompare(appId)) {
                        logger.info(`${appId} recieved: ${raw}`)
                        const messageType = dict.message_type
                        if (0 === messageType.localeCompare("component_subscription_update")) {
                            await onAdminQueryResponse(dict)
                        }
                        else if ( 0 === messageType.localeCompare("component_enquiry")) {
                            await onComponentEnquiry(dict)
                        }
                        else if ( 0 === messageType.localeCompare("component_enquiry_response")) {
                            await onWebServerEnquiryResponse(dict)
                        }
                    }

		} catch(err) {
		    logger.warn(`Got error while processsing {topic:partition:offset}: ${topic}:${partition}:${message.offset+1}, details: ${err.message}`)
		} finally {
		    await consumer.commitOffsets([{ topic, partition, offset: message.offset + 1 }])
		}
            },
        })
    
    setInterval(()=>{
        sendAdminEvent(AdminEvents.HeartBeat).then(()=>{}).catch((err)=>{
            console.log(`Error while sending HeartBeat event, details: ${err.message}`)
        })
    }, 5000)

    await sendAdminQuery()

    launchHttpCommunicationEngine(app, logger)
    httpServer.listen(listenPort, () => {
        console.log(`listening on ${listenPort}...`)
    });
}

run().then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}`)
})
