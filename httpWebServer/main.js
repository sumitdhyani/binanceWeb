const express = require('express')
const app = express()
const httpHandle = require('http')
const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const Socket_io = require('socket.io')
const { SubscriptionHandler } = require('./SubscriptionHandler')
const jwt = require('jsonwebtoken')
const { getLimits } = require('./tierConfig')
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

let subscriptionHandler = null
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production'

async function mainLoop(logger){
    subscriptionHandler = new SubscriptionHandler(api.subscribePrice,
                                                  api.unsubscribePrice,
                                                  api.subscribeVirtualPrice,
                                                  api.unsubscribeVirtualPrice,
                                                  createVirtualTradingPairName,
                                                  logger)

    // JWT auth middleware — reject connections without valid token
    io.use((socket, next) => {
        const token = socket.handshake.auth && socket.handshake.auth.token
        if (!token) {
            return next(new Error('Authentication required'))
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET)
            socket.user = decoded
            socket.limits = getLimits(decoded.tier)
            next()
        } catch (err) {
            next(new Error('Invalid or expired token'))
        }
    })

    io.on('connection', (socket) =>{
        sendWebserverEvent(WebserverEvents.NewConnection).then(()=>{}).catch((err)=>{
            console.log(`Error whle sending NewConnection event, details: ${err.message}`)
        })
        
        logger.info(`New connection, id: ${socket.id}`)
        let subscriptions = new Set()
        let depthCount = 0
        let tradeCount = 0
        let virtualCount = 0
        let basketCount = 0
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

            // Enforce tier limits
            const limits = socket.limits
            if (type === 'depth' && depthCount >= limits.depth) {
                return acknowledge({success: false, reason: `Depth subscription limit reached (${limits.depth}). Upgrade your account for more.`})
            } else if (type === 'trade' && tradeCount >= limits.trade) {
                return acknowledge({success: false, reason: `Trade subscription limit reached (${limits.trade}). Upgrade your account for more.`})
            } else if (type === 'virtual' && virtualCount >= limits.virtual) {
                return acknowledge({success: false, reason: `Virtual price limit reached (${limits.virtual}). Upgrade your account for more.`})
            } else if (type === 'basket' && basketCount >= limits.basket) {
                return acknowledge({success: false, reason: `Basket limit reached (${limits.basket}). Upgrade your account for more.`})
            }

            subscriptionHandler.subscribe(symbol, exchange, type, updateCallback).
            then(()=>{
                subscriptions.add(key)
                if (type === 'depth') depthCount++
                else if (type === 'trade') tradeCount++
                else if (type === 'virtual') virtualCount++
                else if (type === 'basket') basketCount++
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
                if (type === 'depth') depthCount--
                else if (type === 'trade') tradeCount--
                else if (type === 'virtual') virtualCount--
                else if (type === 'basket') basketCount--
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

process.on('SIGTERM', async () => { await subscriptionHandler.unsubscribeAll() });
process.on('SIGINT', async () => { await subscriptionHandler.unsubscribeAll() });