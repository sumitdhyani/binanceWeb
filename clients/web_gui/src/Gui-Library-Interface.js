const { SubscriptionHandler } = require('./SubscriptionHandler')
const { VirtualSubscriptionHandler } = require('./VirtualSubscriptionHandler')
const { launch, raise_request, download_instruments} = require('./root/ClientLayerLibrary/ClientInterface')
                                    
let subscriptionHandler = null
let virtualSubscriptionHandler = null
let libLogger = null
function subscribe(symbol , exchange, callback){
    subscriptionHandler.subscribe(symbol , exchange, callback)
}

function unsubscribe(symbol , exchange, callback){
    subscriptionHandler.unsubscribe(symbol , exchange, callback)
}

let exchangeSymbolNameGenerators = {BINANCE : (asset, currency, exchange)=> {
    const symbol = asset.concat(currency)
    libLogger.debug(`Generated name: ${symbol}`)    
    return symbol   
}}


function subscribeVirtual(asset, currency, bridge, exchange, callback){

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

    virtualSubscriptionHandler.unsubscribe(asset,
                                         currency,
                                         bridge,
                                         exchange,
                                         callback)
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
                                                        console.log(`Intent: ${JSON.stringify([symbol, exchange])}`)
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

        virtualSubscriptionHandler = new VirtualSubscriptionHandler(subscriptionHandler.subscribe,
                                                                    subscriptionHandler.unsubscribe,
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