api = require("./apiHandle.js");
//THis will be set by the logger given by the API
let logger = null

async function onNewSymbol(symbolDetails)
{
    logger.log('info', `New instrument received: ${JSON.stringify(symbolDetails)}`) 
}

async function onAllSymbols(lump)
{
    logger.info(`All instruments received: ${JSON.stringify(lump)}`)
}

async function actionForVirtualSymbol(action, asset, currency, bridge)
{
    if(0 == action.localeCompare("subscribe"))
    {
        try
        {
            api.subscribeVirtualPrice(asset, currency, bridge, onVirtualPrice)
        }
        catch(err)
        {
            console.log(err)
        }
    }
    else
    {
        try
        {
            api.unsubscribeVirtualPrice(asset, currency, bridge, onVirtualPrice)
        }
        catch(err)
        {
            console.log(err)
        }
    }
}


async function actionForNormalSymbol(action, symbol)
{
    if(0 == action.localeCompare("subscribe"))
    {
        try
        {
            api.subscribePrice(symbol, onPrice)
        }
        catch(err)
        {
            console.log(err)
        }
    }
    else
    {
        try
        {
            api.unsubscribePrice(symbol, onPrice)
        }
        catch(err)
        {
            console.log(err)
        }
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

//This is the entry point of the application, this method is passed to the start method as you will see below
async function mainLoop(apiLogger)
{
    logger = apiLogger
    api.downloadAllSymbols(onNewSymbol, ()=>{})
    api.downloadAllSymbolsInLump(onAllSymbols)
    while(true)
        await performNextAction()
}

function onPrice(price)
{
    logger.info(`Normal price recieved: ${JSON.stringify(price)}`)
}


function onVirtualPrice(price)
{
    logger.info(`Virtual price recieved: ${JSON.stringify(price)}`)
}

api.start("test", mainLoop, ['localhost:9092','127.0.0.1:9092'], "DemoApp", api.Loglevel.DEBUG).then(()=>{})
