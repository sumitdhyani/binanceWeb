const { Kafka } = require('kafkajs')
const winston = require('winston')
const CommonUtils = require("../CommonUtils")
const appSpecificErrors = require('../appSpecificErrors')
const api = require('../apiHandle')
const process = require('process')
const express = require('express')
const app = express()
const httpHandle = require('http')
const { json } = require('express')
//const { isAsyncFunction } = require('util/types')
//const { setMaxIdleHTTPParsers } = require('http')
const NativeLoglevel = api.Loglevel
const WebserverEvents= api.WebserverEvents
//Key: appId of feedServer,
//Value: array of 2 elements [0] = no. of clients connected currently, [1] = all the other details of the feed_server
feedServerBook = new Map()
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


const broker = process.argv[2] 
const listenPort = parseInt(process.argv[3])
const appId = process.argv[4]
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
    appGroup = dict["appGroup"]

    if(appGroup != "FeedServer"){
        return
    }

    if(0 == evt.localeCompare("app_up")){
        if(!feedServerBook.has(appName)){
            feedServerBook.set(appName, [0, dict])
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
            feedServerBook.set(appName, [0, result])
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

async function sendAdminQuery(){
    dict = {destination_topic : appId, eq : {appGroup : "FeedServer"}}
    await producer.send({ topic: "admin_queries", messages: [{ key: appId, value: JSON.stringify(dict) }] })
}

async function sendWebserverQuery(topic){
    dict = {destination_topic : appId, message_type : "component_enquiry"}
    await producer.send({ topic: topic, messages: [{ key: appId, value: JSON.stringify(dict) }] })
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
        lowest = -1
        currServer = null
        feedServerBook.forEach((value, key) => {
            if(value[0] > lowest){
                lowest = value[0]
                currServer = value[1]
            }
        });
        if(lowest != -1){
            logger.info(JSON.stringify(feedServerBook))
            logger.info(`On http request, returning the server: ${JSON.stringify(currServer)}`)
            res.send({success : true, 
                      feed_server : currServer["hostPort"]})
        }
        else{
            res.send({success : false, 
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
        brokers: [broker],
        logLevel: enumToKafkaLogLevel(logLevel),
        logCreator: (logLevel) => {
            return WinstonLogCreator(logLevel, "Logs/" + kafkFileName)
        }
    })

    const admin = kafka.admin()
    consumer = kafka.consumer({ groupId: appId })
    producer = kafka.producer()
    await admin.connect()
    await consumer.connect()
    await producer.connect()

    //Create the inbound topic for this service
    await admin.createTopics({
        topics: [{ topic: appId, replicationFactor: 1, numPartitions: 1 }]
    })

    await consumer.subscribe({ topic: 'webserver_events', fromBeginning: false })
    await consumer.subscribe({ topic: 'admin_events', fromBeginning: false })
    await consumer.subscribe({ topic: appId, fromBeginning: false })
    logger = CommonUtils.createFileLogger("Logs/" + appFileName, enumToWinstomLogLevel(logLevel))
    await sendAdminEvent(AdminEvents.Registration)

    await consumer.run(
        {
            eachMessage: async ({ topic, partition, message }) => {
                const raw = message.value.toString()
                const dict = JSON.parse(raw)
                logger.info(`Data recieved: ${JSON.stringify(dict)}`)
                
                if(topic == "admin_events"){
                    logger.info(`admin_events recieved: ${JSON.stringify(dict)}`)
                    onAdminEvent(dict)
                }
                else if(topic == "webserver_events"){
                    logger.info(`webserver_events recieved: ${JSON.stringify(dict)}`)
                    onWebserverEvt(dict)
                }
                else if(topic == appId){
                    logger.info(`${appId} recieved: ${JSON.stringify(dict)}`)
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

    launchHttpCommunicationEngine(app, logger)
    httpServer.listen(listenPort, () => {
        console.log(`listening on ${listenPort}...`)
    });
}

run().then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}`)
})