const { io } = require('socket.io-client')
const appSpecificErrors = require('../../appSpecificErrors')

let sock = null

subscriptionBook = new Set()
let disconnectionHandler = null

function subscribe(symbol, exchange){
    const key = JSON.stringify([symbol, exchange])
    if(subscriptionBook.has(key)){
        throw new appSpecificErrors.DuplicateSubscription(`Duplicate subscription for ${key}`)
    }

    subscriptionBook.add(key)
    sock.emit('subscribe', symbol, exchange)
}

function unsubscribe(symbol, exchange){
    const key = JSON.stringify([symbol, exchange])
    if(!subscriptionBook.has(key)){
        throw new appSpecificErrors.SpuriousUnsubscription()
    }
    
    subscriptionBook.delete(key)
    sock.emit('unsubscribe', symbol, exchange)
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
    else if(0 == action.localeCompare("unsubscribe")){
        forwardUnsubscription(intent)
    }else if(0 == action.localeCompare("disconnect")){
        sock.disconnect()
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
    logger.debug(`Connecting to the server ${serverAddress}`)
    sock = io(serverAddress)
    sock.on('connect', ()=>{
        logger.debug(`Connected by id: ${sock.id}`)
    })

    sock.on('disconnect', (reason)=>{
        logger.warn(`Disconnection, id: ${sock.id}, reason: ${reason}`)
        callback(JSON.stringify({ message_type : "disconnection", reason : reason}))
        subscriptionBook.clear()
        if(null !== disconnectionHandler){
            setTimeout(()=>disconnectionHandler(reason), 0);
        }
    })

    sock.on('depth', (depth)=>{
        callback(depth)
    })

    sock.on('virtualDepth', (depth)=>{
        logger.debug(`Virtual depth recieved: ${depth}`)
    })

    sock.on('subscriptionSuccess', (symbol)=>{
        logger.debug(`subscriptionSuccess for: ${symbol}`)
    })

    sock.on('subscriptionFailure', (symbol, reason)=>{
        logger.warn(`subscriptionFailure for: ${symbol}, reason: ${reason}`)
    })

    sock.on('unsubscriptionSuccess', (symbol)=>{
        logger.debug(`unsubscriptionSuccess for: ${symbol}`)
    })

    sock.on('unsubscriptionFailure', (symbol, reason)=>{
        logger.warn(`unsubscriptionFailure for: ${symbol}, reason: ${reason}`)
    })

    sock.on('virtualSubscriptionSuccess', (asset, currency, bridge)=>{
        logger.debug(`virtualSubscriptionSuccess for: ${asset + "_" + currency + "_" + bridge}`)
    })

    sock.on('virtualSubscriptionFailure', (asset, currency, bridge, reason)=>{
        logger.warn(`virtualSubscriptionFailure for: ${asset + "_" + currency + "_" + bridge}, reason: ${reason}`)
    })

    sock.on('virtualUnsubscriptionSuccess', (asset, currency, bridge)=>{
        logger.debug(`virtualUnsubscriptionSuccess for: ${asset + "_" + currency + "_" + bridge}`)
    })

    sock.on('virtualUnsubscriptionFailure', (asset, currency, bridge, reason)=>{
        logger.warn(`virtualUnsubscriptionFailure for: ${asset + "_" + currency + "_" + bridge}, reason: ${reason}`)
    })
}

function setDisconnectionHandler(callback){
    disconnectionHandler = callback
}

module.exports.connect = connect
module.exports.forward = forward
module.exports.disconnect = disconnect
module.exports.setDisconnectionHandler = setDisconnectionHandler
