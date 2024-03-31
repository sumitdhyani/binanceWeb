const { SubscriptionHandler } = require('./SubscriptionHandler')
const { VirtualSubscriptionHandler } = require('./VirtualSubscriptionHandler')
const { BasketSubscriptionHandler } = require('./BasketSubscriptionHandler')
const { launch, raise_request, download_instruments} = require('./root/ClientLayerLibrary/ClientInterface')
                                    
let subscriptionHandler = null
let virtualSubscriptionHandler = null
let basketSubscriptionHandler = null

let libLogger = null
function subscribe(symbol , exchange, callback){
    libLogger.debug(`subscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.subscribe(symbol , exchange, callback)
}

function unsubscribe(symbol , exchange, callback){
    libLogger.debug(`unsubscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.unsubscribe(symbol , exchange, callback)
}

let exchangeSymbolNameGenerators = {BINANCE : (asset, currency, exchange)=> asset.concat(currency)}


function subscribeVirtual(asset, currency, bridge, exchange, callback){
    libLogger.debug(`subscribeVirtual, arguments: ${JSON.stringify(arguments)}`)
    let exchangeSymbolNameGenerator = exchangeSymbolNameGenerators[exchange]
    if(undefined !== exchangeSymbolNameGenerator){
        virtualSubscriptionHandler.subscribe(asset,
                                             currency,
                                             bridge,
                                             exchange,
                                             callback,
                                             exchangeSymbolNameGenerator)
    }else{
        libLogger.error(`Symbol name generation method for this exchange in not defined`)
    }
}

function unsubscribeVirtual(asset, currency, bridge, exchange, callback){
    libLogger.debug(`unsubscribeVirtual, arguments: ${JSON.stringify(arguments)}`)
    virtualSubscriptionHandler.unsubscribe(asset,
                                         currency,
                                         bridge,
                                         exchange,
                                         callback)
}

function subscribeBasket(reqId, symbols, coefficients, currency, priceConverters, exchange, callback){ 
    libLogger.debug(`subscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    basketSubscriptionHandler.subscribe(reqId,
                                        symbols,
                                        coefficients,
                                        currency,
                                        priceConverters,
                                        exchange,
                                        callback)
}

function unsubscribeBasket(reqId){
    libLogger.debug(`unsubscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    basketSubscriptionHandler.unsubscribe(reqId)
}

function onPriceUpdate(update){
    subscriptionHandler.onUpdate(update)
}

function init(auth_params, logger, staticDataCallback){
    download_instruments()
    .then((dict)=>{
        libLogger = logger
        libLogger.debug(JSON.stringify(dict))
        subscriptionHandler = new SubscriptionHandler( (symbol, exchange)=>{
                                                        raise_request({
                                                                action : "subscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        (symbol, exchange)=>{
                                                            raise_request({
                                                                action : "unsubscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        libLogger)

        virtualSubscriptionHandler = new VirtualSubscriptionHandler(subscriptionHandler.subscribe.bind(subscriptionHandler),
                                                                    subscriptionHandler.unsubscribe.bind(subscriptionHandler),
                                                                    libLogger)

        basketSubscriptionHandler = new BasketSubscriptionHandler(
            subscriptionHandler.subscribe.bind(subscriptionHandler),
            subscriptionHandler.unsubscribe.bind(subscriptionHandler),
            libLogger)
            
        launch(auth_params, onPriceUpdate, libLogger)
        staticDataCallback(dict)
    })
}

module.exports.init = init
module.exports.subscribe = subscribe
module.exports.unsubscribe = unsubscribe
module.exports.subscribeVirtual = subscribeVirtual
module.exports.unsubscribeVirtual = unsubscribeVirtual
module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket