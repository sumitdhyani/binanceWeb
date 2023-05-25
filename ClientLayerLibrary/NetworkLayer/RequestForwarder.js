const { io } = require('socket.io-client')
const appSpecificErrors = require('../../IndependentCommonUtils/appSpecificErrors')
const { RequestSerializer } = require('./RequestSerializer')
const { ActionAntiAction } = require('./ActionAntiAction')
let sock = null
let logger = null
subscriptionBook = new Set()
let disconnectionHandler = null
let requestSerializer = null
let actionAntiAction = null
class RequestSerializers{
    constructor(){
        this.serializers = new Map()
    }

    requestToSend(key, sock, event, ack, ...data){
        let serializer = this.serializers.get(key)
        if(undefined == serializer) {
            serializer = new RequestSerializer()
            this.serializers.set(key, serializer)
        }
        serializer.requestToSend(sock, event, ack, ...data)
    }
}

function subscribe(symbol, exchange){
    const key = JSON.stringify([symbol, exchange])
    //if(subscriptionBook.has(key)){
    //    throw new appSpecificErrors.DuplicateSubscription(`Duplicate subscription for ${key}`)
    //}

    actionAntiAction.antiAct(key, ()=>{
        requestSerializer.requestToSend(key, sock, 'subscribe', (result)=>{
            if(result.success) {
                subscriptionBook.add(key)
                logger.warn(`subscriptionSuccess for: ${key}`)
            }else {
                logger.warn(`subscriptionFailure for: ${key}, reason: ${result.reason}`)
            }
        }, symbol, exchange)
    })
}

function unsubscribe(symbol, exchange){
    const key = JSON.stringify([symbol, exchange])
    //if(!subscriptionBook.has(key)){
    //    throw new appSpecificErrors.SpuriousUnsubscription()
    //}
    actionAntiAction.act(key, 10000, ()=>{
        requestSerializer.requestToSend(key, sock, 'unsubscribe', (result)=>{
            if(result.success) {
                subscriptionBook.delete(key)
                logger.warn(`unsubscriptionSuccess for: ${key}`)
            }else {
                logger.warn(`unsubscriptionFailure for: ${key}, reason: ${result.reason}`)
            }
        }, symbol, exchange)
    })
}

function forward(intent){
    const action = intent.action
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
    subscribe(subscription.symbol, subscription.exchange)
}

function forwardUnsubscription(subscription){
    unsubscribe(subscription.symbol, subscription.exchange)
}

function disconnect(){
}

function connect(serverAddress, callback, libLogger){//Server address <ip>:<port>
    actionAntiAction = new ActionAntiAction() 
    logger = libLogger
    requestSerializer = new RequestSerializers()
    logger.debug(`Connecting to the server ${serverAddress}`)
    sock = io(serverAddress)
    sock.on('connect', ()=>{
        logger.debug(`Connected by id: ${sock.id}`)
    })

    sock.on('disconnect', (reason)=>{
        callback(JSON.stringify({ message_type : "disconnection", reason : reason}))
        subscriptionBook.clear()
        if(null !== disconnectionHandler){
            setTimeout(()=>disconnectionHandler(reason), 0);
        }
    })

    sock.on('depth', (depth)=>{
        callback(depth)
    })
}

function setDisconnectionHandler(callback){
    disconnectionHandler = callback
}

module.exports.connect = connect
module.exports.forward = forward
module.exports.disconnect = disconnect
module.exports.setDisconnectionHandler = setDisconnectionHandler
