const prompt = require("prompt-async");
const { io } = require('socket.io-client')
const CommonUils = require("../CommonUtils")
const logger = CommonUils.createFileLogger("TestClientApp.log") 

const serverAddress = `http://${process.argv[2]}`
console.log(`Connecting to the server ${serverAddress}`)


const sock = io(serverAddress)
sock.on('connect', ()=>{
    logger.info(`Connected by id: ${sock.id}`)
})

sock.on('depth', (depth)=>{
    logger.info(`Normal depth recieved: ${depth}`)
})

sock.on('subscriptionSuccess', (symbol)=>{
    logger.info(`subscriptionSuccess for: ${symbol}`)
})

sock.on('subscriptionFailure', (symbol, reason)=>{
    logger.info(`subscriptionFailure for: ${symbol}, reason: ${reason}`)
})

sock.on('unsubscriptionSuccess', (symbol)=>{
    logger.info(`unsubscriptionSuccess for: ${symbol}`)
})

sock.on('unsubscriptionFailure', (symbol, reason)=>{
    logger.info(`unsubscriptionFailure for: ${symbol}, reason: ${reason}`)
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


sock.on('virtualDepth', (depth)=>{
    logger.info(`Virtual depth recieved: ${depth}`)
})

function actionForVirtualSymbol(action, asset, currency, bridge)
{
    if(0 == action.localeCompare("subscribe")){
        sock.emit('subscribeVirtual', asset, currency, bridge)
    }
    else if(0 == action.localeCompare("unsubscribe")){
        sock.emit('unsubscribeVirtual', asset, currency, bridge)
    }
}


async function actionForNormalSymbol(action, symbol)
{
    if(0 == action.localeCompare("subscribe")){
        sock.emit('subscribe', symbol)
    }
    else if(0 == action.localeCompare("unsubscribe")){
        sock.emit('unsubscribe', symbol)
    }
}

async function performNextAction()
{
    prompt.start()
    const {action, symbol} = await prompt.get(["action", "symbol"])
    parts = symbol.split(" ")
    if(parts.length == 1)
        actionForNormalSymbol(action, symbol)
    else
        actionForVirtualSymbol(action, parts[0], parts[1], parts[2])
}


async function performNextAction()
{
    prompt.start()
    const {action, symbol} = await prompt.get(["action", "symbol"])
    parts = symbol.split(" ")
    if(parts.length == 1)
        actionForNormalSymbol(action, symbol)
    else
        actionForVirtualSymbol(action, parts[0], parts[1], parts[2])
}

async function mainLoop()
{
    while(true)
        await performNextAction()
}

mainLoop().then(()=>{}) 