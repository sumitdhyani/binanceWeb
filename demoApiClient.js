api = require("./apiHandle.js");
const prompt = require("prompt-async");
//THis will be set by the logger given by the API
let logger = null

function onNewSymbol(symbolDetails)
{
    logger.log('info', `New instrument received: ${JSON.stringify(symbolDetails)}`) 
}

function onAllSymbols(lump)
{
    logger.info(`All instruments received: ${JSON.stringify(lump)}`)
}

function actionForVirtualSymbol(action, asset, currency, bridge)
{
    if(0 == action.localeCompare("subscribe"))
    {
        api.subscribeVirtualPrice(asset, currency, bridge, onVirtualPrice).
        then(()=>{
            logger.info(`Subscription successful for ${asset}_${currency}_${bridge}`)
        }).
        catch((error)=>{
                logger.error(`Failed subscription for ${asset}_${currency}_${bridge}, details: ${error.message}`)
        })
    }
    else
    {
        api.unsubscribeVirtualPrice(asset, currency, bridge, onVirtualPrice).
        then(()=>{
            logger.info(`Unsubscription successful for ${asset}_${currency}_${bridge}`)
        }).
        catch((error)=>{
            logger.error(`Failed unsubscription for ${asset}_${currency}_${bridge}, details: ${error.message}`)
        })
    }
}


async function actionForNormalSymbol(action, symbol)
{
    if(0 == action.localeCompare("subscribe"))
    {
        api.subscribePrice(symbol, onPrice).
        then(()=>{
            logger.info(`Subscription successful for ${symbol}`)
        }).
        catch((error)=>{
                logger.error(`Failed subscription for ${symbol}, details: ${error.message}`)
        })
    }
    else
    {
        api.unsubscribePrice(symbol, onPrice).
        then(()=>{
            logger.info(`Unsubscription successful for ${symbol}`)
        }).
        catch((error)=>{
                logger.error(`Failed unsubscription for ${symbol}, details: ${error.message}`)
        })
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
