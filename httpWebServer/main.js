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
const createVirtualTradingPairName = CommonUtils.createVirtualTradingPairName
const disintegrateVirtualTradingPairName = CommonUtils.disintegrateVirtualTradingPairName


httpServer.listen(30000, () => {
    console.log("listening on 30000...")
});

async function mainLoop(logger){
    const subscriptionHandler = new SubscriptionHandler(api.subscribePrice,
                                                  api.unsubscribePrice,
                                                  api.subscribeVirtualPrice,
                                                  api.unsubscribeVirtualPrice,
                                                  createVirtualTradingPairName,
                                                  logger)

    io.on('connection', (socket) =>{
        console.log(`New connection, id: ${socket.id}`)
        subscriptions = new Set()
        virtualSubscriptions = new Set()
        const normalPriceCallBack = function(depth){
            socket.emit('depth', JSON.stringify(depth))
        }

        const virtualPriceCallBack = function(depth){
            socket.emit('virtualDepth', JSON.stringify(depth))
        }

        socket.on('disconnect', ()=> {
            logger.warn(`Disconnection, id: ${socket.id}, cancelling all subscriptions`)

            for(let symbol of subscriptions){
                subscriptionHandler.unsubscribe(symbol, normalPriceCallBack).
                then(()=>{
                    logger.info(`Subscription cancelled for connection id: ${socket.id}, symbol: ${symbol}, upon disconnection`)
                }).
                catch((err)=>{
                    logger.info(`Error while cleanup on disconnection for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
                })
            }
            
            for(let virtualSymbol of virtualSubscriptions){
                const [asset, currency, bridge] = disintegrateVirtualTradingPairName(virtualSymbol)
                subscriptionHandler.unsubscribeVirtual(asset, currency, bridge, virtualPriceCallBack).
                then(()=>{
                    logger.info(`Subscription cancelled for connection id: ${socket.id}, symbol: ${symbol}, upon disconnection`)
                }).
                catch((err)=>{
                    logger.info(`Error while cleanup on disconnection for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
                })
            }

            subscriptions.clear()
            virtualSubscriptions.clear()
        })

        socket.on('subscribe', (symbol)=> {
                subscriptionHandler.subscribe(symbol, normalPriceCallBack).
                then(()=>{
                    socket.emit('subscriptionSuccess', symbol)
                    subscriptions.add(symbol)
                    logger.info(`Subscription successsful for connection id: ${socket.id}, symbol: ${symbol}`)
                }).
                catch((err)=>{
                    if(err instanceof DuplicateSubscription){
                        socket.emit('subscriptionFailure', symbol, `Duplicate subscription request for symbol: ${symbol}`)
                    }
                    logger.warn(`Error while subscription for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
                })
        })

        socket.on('unsubscribe', (symbol)=> {
            subscriptionHandler.unsubscribe(symbol, normalPriceCallBack).
            then(()=>{
                socket.emit('unsubscriptionSuccess', symbol)
                subscriptions.delete(symbol)
                logger.info(`Unsubscription successsful for connection id: ${socket.id}, symbol: ${symbol}`)
            }).
            catch((err)=>{
                if(err instanceof SpuriousUnsubscription){
                    socket.emit('unsubscriptionFailure', symbol, `The symbol ${symbol} currently not subscribed for this client`)
                }
                logger.info(`Error while unsubscription for connection id: ${socket.id}, symbol: ${symbol}, details: ${err.message}`)
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

api.start("test", mainLoop, ['localhost:9092','127.0.0.1:9092'], "DemoApp", api.Loglevel.DEBUG).then(()=>{})
