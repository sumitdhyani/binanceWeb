const { launch, subUnsub } = require('./ClientLayerLibrary/ClientInterface')
const constants = require('./ClientLayerLibrary/Constants').constants
const prompt = require("prompt-async")

function forwardUserIntent(intent){
    try{
        intent[constants.tags.exchange] = constants.exchanges.exch_binance
        subUnsub(intent)
    }
    catch(err){
        console.log(err.message)
    }
}

function onData(data){
    console.log(`Received data: ${JSON.stringify(data)}`)
}

launch({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}}, onData, (msg)=>{console.log(msg)})

function actionForVirtualSymbol(action, asset, currency, bridge)
{
    forwardUserIntent({action : action,
              asset : asset, 
              currency : currency, 
              bridge : bridge})
}


async function actionForNormalSymbol(action, symbol)
{
    forwardUserIntent({action : action,
              symbol : symbol})
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

//This is the entry point of the application, this method is passed to the start method as you will see below
async function mainLoop()
{
    while(true)
        await performNextAction()
}

mainLoop().then(()=>{})