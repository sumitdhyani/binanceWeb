const { io } = require('socket.io-client')

let sock = null

function subscribe(symbol, exchange){
    sock.emit('subscribe', symbol)
}

function unsubscribe(symbol, exchange){
    sock.emit('unsubscribe', symbol)
}

function subscribeVirtual(asset, currency, bridge, exchange){
    sock.emit('subscribeVirtual', asset, currency, bridge)
}

function unsubscribeVirtual(asset, currency, bridge, exchange){
    sock.emit('unsubscribeVirtual', asset, currency, bridge)
}

function forward(intent){
    let action = intent.action
    if(0 == action.localeCompare("subscribe")){
        forwardSubscription(intent)
    }
    else{
        forwardUnsubscription(intent)
    }
}

function forwardSubscription(subscription){
    if(undefined == subscription.asset){
        subscribe(subscription.symbol, subscription.exchange)
    }
    else{
        subscribeVirtual(subscription.asset, subscription.currency, subscription.bridge, subscription.exchange)
    }
}

function forwardUnsubscription(subscription){
    if(undefined == subscription.asset){
        unsubscribe(subscription.symbol, subscription.exchange)
    }
    else{
        unsubscribeVirtual(subscription.asset, subscription.currency, subscription.bridge, subscription.exchange)
    }
}

function disconnect(){
}

function connect(serverAddress, callback, logger){//Server address <ip>:<port>
    logger(`Connecting to the server ${serverAddress}`)
    sock = io(serverAddress)
    sock.on('connect', ()=>{
        logger(`Connected by id: ${sock.id}`)
    })

    sock.on('depth', (depth)=>{
        callback(depth)
    })

    sock.on('subscriptionSuccess', (symbol)=>{
        logger(`subscriptionSuccess for: ${symbol}`)
    })

    sock.on('subscriptionFailure', (symbol, reason)=>{
        logger(`subscriptionFailure for: ${symbol}, reason: ${reason}`)
    })

    sock.on('unsubscriptionSuccess', (symbol)=>{
        logger(`unsubscriptionSuccess for: ${symbol}`)
    })

    sock.on('unsubscriptionFailure', (symbol, reason)=>{
        logger(`unsubscriptionFailure for: ${symbol}, reason: ${reason}`)
    })

    sock.on('virtualSubscriptionSuccess', (asset, currency, bridge)=>{
        logger.info(`virtualSubscriptionSuccess for: ${asset + "_" + currency + "_" + bridge}`)
    })

    sock.on('virtualSubscriptionFailure', (asset, currency, bridge, reason)=>{
        logger.info(`virtualSubscriptionFailure for: ${asset + "_" + currency + "_" + bridge}, reason: ${reason}`)
    })

    sock.on('virtualUnsubscriptionSuccess', (asset, currency, bridge)=>{
        logger.info(`virtualUnsubscriptionSuccess for: ${asset + "_" + currency + "_" + bridge}`)
    })

    sock.on('virtualUnsubscriptionFailure', (asset, currency, bridge, reason)=>{
        logger.info(`virtualUnsubscriptionFailure for: ${asset + "_" + currency + "_" + bridge}, reason: ${reason}`)
    })

    sock.on('subscriptionFailure', (symbol, reason)=>{
        logger.info(`subscriptionSuccess for: ${symbol}, reason: ${reason}`)
    })
}

module.exports.connect = connect
module.exports.forward = forward
module.exports.disconnect = disconnect