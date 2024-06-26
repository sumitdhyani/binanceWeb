const express = require('express')
const app = express()
const httpHandle = require('http')
const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const Socket_io = require('socket.io')
const { SubscriptionHandler } = require('./SubscriptionHandler')
const httpServer = httpHandle.createServer(app)
const io = new Socket_io.Server(httpServer, {cors: {origin: "*"}})
const appSpecificErrors = require('../IndependentCommonUtils/appSpecificErrors')
const { Logger } = require('winston')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription
const DuplicateSubscription = appSpecificErrors.DuplicateSubscription
const InvalidSymbol = appSpecificErrors.InvalidSymbol
const createVirtualTradingPairName = CommonUtils.createVirtualTradingPairName
const disintegrateVirtualTradingPairName = CommonUtils.disintegrateVirtualTradingPairName
const sendWebserverEvent = api.sendWebserverEvent
const WebserverEvents = api.WebserverEvents

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

const brokers = process.argv[2].split(",")
const listenPort = parseInt(process.argv[3])
const appId = process.argv[4]
let logLevel = api.Loglevel.INFO
if(undefined !== process.argv[5]){
    logLevel = stringToAPILogLevel(process.argv[5])
}

httpServer.listen(listenPort, () => {
    console.log(`listening on ${listenPort}...`)
});

async function mainLoop(logger){
    const subscriptionHandler = new SubscriptionHandler(api.subscribePrice,
                                                  api.unsubscribePrice,
                                                  api.subscribeVirtualPrice,
                                                  api.unsubscribeVirtualPrice,
                                                  createVirtualTradingPairName,
                                                  logger)

    io.on('connection', (socket) =>{
        sendWebserverEvent(WebserverEvents.NewConnection).then(()=>{}).catch((err)=>{
            console.log(`Error whle sending NewConnection event, details: ${err.message}`)
        })
        
        logger.info(`New connection, id: ${socket.id}`)
        let subscriptions = new Set()
        function updateCallback(update, raw){
            logger.debug(`Recd update in main.js`)
            if (0 === update.message_type.localeCompare("depth")) {
                socket.volatile.emit('depth', raw)
            } else if (0 === update.message_type.localeCompare("trade")) {
                socket.volatile.emit('trade', raw)
            }
        }

        socket.on('disconnect', (reason)=> {
            sendWebserverEvent(WebserverEvents.Disconnection).then(()=>{}).catch((err)=>{
                console.log(`Error whlie sending Disconnection event, details: ${err.message}`)
            })
            logger.warn(`Disconnection, id: ${socket.id}, reason: ${reason} cancelling all subscriptions(${subscriptions.size})`)

            for(const key of subscriptions){
                const [symbol, exchange, type] = JSON.parse(key)
                subscriptionHandler.unsubscribe(symbol, exchange, type, updateCallback).
                then(()=>{
                    logger.debug(`Subscription cancelled for connection id: ${socket.id}, symbol: ${key} upon disconnection`)
                }).
                catch((err)=>{
                    logger.warn(`Error while cleanup on disconnection for connection id: ${socket.id}, symbol: ${key}, details: ${err.message}`)
                })
            }

            subscriptions.clear()
        })

        socket.on('subscribe', (symbol, exchange, type, acknowledge)=>{
            const key = JSON.stringify([symbol, exchange, type])
            logger.info(`Received subscription for connection id: ${socket.id}, symbol: ${key}`)
            subscriptionHandler.subscribe(symbol, exchange, type, updateCallback).
            then(()=>{
                subscriptions.add(key)
                logger.info(`Acknowledging Subscription successsful for ${key}`)
                acknowledge({success : true})
            }).
            catch((err)=>{
                logger.warn(`Acknowledging Subscription failure for ${key}, reason: ${err.message}`)
                const reason = (err instanceof DuplicateSubscription)?
                               `Duplicate subscription request for symbol: ${key}`:
                               (err instanceof InvalidSymbol)?
                               `Invalid symbol: ${key}` : err.message
                acknowledge({success : false, reason : reason})
            })
        })

        socket.on('unsubscribe',(symbol, exchange, type, acknowledge)=>{
            const key = JSON.stringify([symbol, exchange, type])
            logger.info(`Received unsubscription for connection id: ${socket.id}, symbol: ${key}`)
            subscriptionHandler.unsubscribe(symbol, exchange, type, updateCallback).
            then(()=>{
                subscriptions.delete(key)
                logger.info(`Acknowledging unsubscription successsful for ${key}`)
                acknowledge({success : true})
            }).
            catch((err)=>{
                const reason = (err instanceof SpuriousUnsubscription)?
                               `The symbol ${key} currently not subscribed for this client` : ""
                logger.warn(`Acknowledging unsubscription failure for ${key}, reason: ${reason}`)
                acknowledge({success : false, reason : reason})
            })
        })
    })
}

api.start(appId, mainLoop, brokers, appId, listenPort, logLevel).then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}, exiting...`)
    process.exit(0)
})
