const { SubscriptionHandler } = require('./SubscriptionHandler')
const { launch, raise_request, download_instruments} = require('./root/ClientLayerLibrary/ClientInterface')

let subscriptionHandler = null
let libLogger = null
function subscribe(symbol , exchange, callback){
    subscriptionHandler.subscribe(symbol , exchange, callback)
}

function unsubscribe(symbol , exchange, callback){
    subscriptionHandler.unsubscribe(symbol , exchange, callback)
}

function onUpdate(update){
    subscriptionHandler.onUpdate(update)
}

function init(auth_params, logger, staticDataCallback){
    download_instruments()
    .then((dict)=>{
        libLogger = logger
        libLogger.debug(JSON.stringify(dict))
        subscriptionHandler = new SubscriptionHandler( (symbol, exchange, callback)=>{
                                                            raise_request({
                                                                action : "subscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        (symbol, exchange, callback)=>{
                                                            raise_request({
                                                                action : "unsubscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        libLogger)

        launch(auth_params, onUpdate, libLogger)
        staticDataCallback(dict)
    })
}

module.exports.init = init
module.exports.subscribe = subscribe
module.exports.unsubscribe = unsubscribe