const express = require('express')
const app = express()
const httpHandle = require('http')
const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const Socket_io = require('socket.io')
const { SubscriptionHandler } = require('./SubscriptionHandler')
const httpServer = httpHandle.createServer(app)
const io = new Socket_io.Server(httpServer)
const appSpecificErrors = require('../appSpecificErrors')
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

const broker = process.argv[2] 
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
        console.log(`New connection, id: ${socket.id}`)
        subscriptions = new Set()
        virtualSubscriptions = new Set()
        const normalPriceCallBack = function(depth){
            socket.emit('depth', depth)
        }

        const virtualPriceCallBack = function(depth){
            socket.emit('virtualDepth', depth)
        }

        socket.on('disconnect', ()=> {
            sendWebserverEvent(WebserverEvents.Disconnection).then(()=>{}).catch((err)=>{
                console.log(`Error whlie sending Disconnection event, details: ${err.message}`)
            })
            logger.warn(`Disconnection, id: ${socket.id}, cancelling all subscriptions`)

            for(const key of subscriptions){
                const [symbol, exchange] = JSON.parse(key)
                subscriptionHandler.unsubscribe(symbol, exchange, normalPriceCallBack).
                then(()=>{
                    logger.info(`Subscription cancelled for connection id: ${socket.id}, symbol: ${key} upon disconnection`)
                }).
                catch((err)=>{
                    logger.info(`Error while cleanup on disconnection for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
                })
            }
            
            for(let virtualSymbol of virtualSubscriptions){
                const [asset, currency, bridge] = disintegrateVirtualTradingPairName(virtualSymbol)
                subscriptionHandler.unsubscribeVirtual(asset, currency, bridge, virtualPriceCallBack).
                then(()=>{
                    logger.info(`Subscription cancelled for connection id: ${socket.id}, symbol: ${virtualSymbol}, upon disconnection`)
                }).
                catch((err)=>{
                    logger.info(`Error while cleanup on disconnection for connection id: ${socket.id}, symbol: ${virtualSymbol}, details: ${err.message}`)
                })
            }

            subscriptions.clear()
            virtualSubscriptions.clear()
        })

        socket.on('subscribe', (symbol, exchange)=> {
                const key = JSON.stringify([symbol, exchange])
                subscriptionHandler.subscribe(symbol, exchange, normalPriceCallBack).
                then(()=>{
                    socket.emit('subscriptionSuccess', key)
                    subscriptions.add(key)
                    logger.info(`Subscription successsful for connection id: ${socket.id}, symbol: ${key}`)
                }).
                catch((err)=>{
                    if(err instanceof DuplicateSubscription){
                        socket.emit('subscriptionFailure', key, `Duplicate subscription request for symbol: ${key}`)
                    }
                    else if(err instanceof InvalidSymbol){
                        socket.emit('subscriptionFailure', key, `Invalid symbol: ${key}`)
                    }
                    logger.warn(`Error while subscription for connection id: ${socket.id}, symbol: ${key}, details: ${err.message}`)
                })
        })

        socket.on('unsubscribe', (symbol, exchange)=> {
            const key = JSON.stringify([symbol, exchange])
            subscriptionHandler.unsubscribe(symbol, exchange, normalPriceCallBack).
            then(()=>{
                socket.emit('unsubscriptionSuccess', key)
                subscriptions.delete(key)
                logger.info(`Unsubscription successsful for connection id: ${socket.id}, symbol: ${key}`)
            }).
            catch((err)=>{
                if(err instanceof SpuriousUnsubscription){
                    socket.emit('unsubscriptionFailure', key, `The symbol ${key} currently not subscribed for this client`)
                }
                logger.info(`Error while unsubscription for connection id: ${socket.id}, symbol: ${key}, details: ${err.message}`)
            })
        })

        socket.on('subscribeVirtual', (asset, currency, bridge)=> {
            symbol = createVirtualTradingPairName(asset, currency, bridge)
            subscriptionHandler.subscribeVirtual(asset, currency, bridge, virtualPriceCallBack).
            then(()=>{
                socket.emit('virtualSubscriptionSuccess', asset, currency, bridge)
                virtualSubscriptions.add(symbol)
                logger.info(`Subscription successsful for connection id: ${socket.id}, symbol: ${symbol}`)
            }).
            catch((err)=>{
                if(err instanceof DuplicateSubscription){
                    socket.emit('virtualSubscriptionFailure', asset, currency, bridge, `Duplicate subscription request for symbol: ${symbol}`)
                }
                else if(err instanceof InvalidSymbol){
                    socket.emit('virtualSubscriptionFailure', asset, currency, bridge, `Invalid symbol: ${symbol}`)
                }
                logger.warn(`Error while subscription for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
            })
        })

        socket.on('unsubscribeVirtual', (asset, currency, bridge)=> {
            const symbol = createVirtualTradingPairName(asset, currency, bridge)
            subscriptionHandler.unsubscribeVirtual(asset, currency, bridge, virtualPriceCallBack).
            then(()=>{
                socket.emit('virtualUnsubscriptionSuccess', asset, currency, bridge)
                virtualSubscriptions.delete(symbol)
                logger.info(`Unsubscription successsful for connection id: ${socket.id}, symbol: ${symbol}`)
            }).
            catch((err)=>{
                if(err instanceof SpuriousUnsubscription){
                    socket.emit('virtualUnsubscriptionFailure', asset, currency, bridge, `The symbol ${symbol} currently not subscribed for this client`)
                }
                logger.info(`Error while unsubscription for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
            })
        })
    })
}

api.start(appId, mainLoop, [broker], appId, listenPort, logLevel).then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}, exiting...`)
    process.exit(0)
})
