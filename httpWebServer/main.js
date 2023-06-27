const {listen} = require('../CommunicationLayer')
const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const { SubscriptionHandler } = require('./SubscriptionHandler')
const appSpecificErrors = require('../IndependentCommonUtils/appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription
const DuplicateSubscription = appSpecificErrors.DuplicateSubscription
const InvalidSymbol = appSpecificErrors.InvalidSymbol
const createVirtualTradingPairName = CommonUtils.createVirtualTradingPairName
const sendWebserverEvent = api.sendWebserverEvent
const WebserverEvents = api.WebserverEvents

function stringToAPILogLevel(level) {
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
if(undefined !== process.argv[5]){
    logLevel = stringToAPILogLevel(process.argv[5])
}

async function mainLoop(logger) {
    const subscriptionHandler = new SubscriptionHandler(api.subscribePrice,
                                                  api.unsubscribePrice,
                                                  api.subscribeVirtualPrice,
                                                  api.unsubscribeVirtualPrice,
                                                  createVirtualTradingPairName,
                                                  logger)

    listen(listenPort,  (clientConnectionHandle) => {
            sendWebserverEvent(WebserverEvents.NewConnection)
            .then(()=> {
                const priceUpdateCallback = update=> {
                    clientConnectionHandle.send('depth', update)
                }

                const subscriptions = new Set()
                clientConnectionHandle.subscribe({
                    disconnect: reason=> {
                        sendWebserverEvent(WebserverEvents.Disconnection).then(()=>{}).catch((err)=>{
                            console.log(`Error while sending Disconnection event, details: ${err.message}`)
                        })
                        
                        for(const key of subscriptions){
                            const [symbol, exchange] = JSON.parse(key)
                            subscriptionHandler.unsubscribe(symbol, exchange, priceUpdateCallback).
                            then(()=>{}).
                            catch((err)=>{
                                logger.warn(`Error while cleanup on disconnection for connection, symbol: ${key}, details: ${err.message}`)
                            })
                        }
                        subscriptions.clear()
                    },

                    subscribe:  (symbol, exchange, acknowledge)=> {
                        const key = JSON.stringify([symbol, exchange])
                        subscriptionHandler.subscribe(symbol, exchange, priceUpdateCallback).
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
                    },

                    unsubscribe: (symbol, exchange, acknowledge)=> {
                        const key = JSON.stringify([symbol, exchange])
                        logger.info(`Received unsubscription for symbol: ${key}`)
                        subscriptionHandler.unsubscribe(symbol, exchange, priceUpdateCallback).
                        then(()=>{
                            subscriptions.delete(key)
                            logger.info(`Acknowledging unsubscription successsful for ${key}`)
                            acknowledge({success : true})
                        }).
                        catch((err)=>{
                            const reason = (err instanceof SpuriousUnsubscription)?
                                           `The symbol ${key} currently not subscribed for this client` : err.message
                            logger.warn(`Acknowledging unsubscription failure for ${key}, reason: ${reason}`)
                            acknowledge({success : false, reason : reason})
                        })
                    }
                })
            })
            .catch((err)=>{
                console.log(`Error while sending NewConnection event, details: ${err.message}`)
            })
    })
}

api.start(appId, mainLoop, brokers, appId, listenPort, logLevel).then(()=>{}).catch((err)=>{
    console.log(`Error in init phase, details: ${err.message}, exiting...`)
    process.exit(0)
})
