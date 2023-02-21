const winston = require('winston')
const { launch, subUnsub } = require('../ClientLayerLibrary/ClientInterface')
const prompt = require("prompt-async");
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("../CommonUtils")
const symbolDict = new Map()

logger = CommonUtils.createFileLogger("LoadTestClient", 'debug')

function sleep(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        //console.log("Done waiting");
        resolve(ms)
      }, ms )
    })
}  

async function loadSymbols() {
    const fileStream = fs.createReadStream('symbols.txt');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        dict = JSON.parse(line)
        const desc = dict["baseAsset"] + " vs " + dict["quoteAsset"]
        dict["description"] = desc
        symbol = dict["symbol"]
        symbolDict.set(symbol, dict)
    }
}

function onData(data){
    //console.log(`Received data: ${JSON.stringify(data)}`)
}

launch({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}}, onData, (msg)=>{logger.info(msg)})

async function actionForNormalSymbol(action, symbol)
{
    try{
        subUnsub({action : action,
                symbol : symbol,
                exchange : "BINANCE"})
    }
    catch(err){
        logger.warn(`Error while ${action} for ${symbol}, details: ${err.message}`)
    }
}

//This is the entry point of the application, this method is passed to the start method as you will see below
async function mainLoop()
{
    low = parseInt(process.argv[2])
    mid = parseInt(process.argv[3])
    high = parseInt(process.argv[4])
    delay = parseInt(process.argv[5])

    const localSymbols = []
    await loadSymbols()
    let i = 0
    for(const [symbol, obj] of symbolDict){
        localSymbols.push(symbol)
        if(++i == high){
            break
        }
    }

    symbolDict.clear()

    for(i = 0; i < high; i++){
        //console.log(localSymbols[i])
        await sleep(delay)
        actionForNormalSymbol("subscribe", localSymbols[i])
    }

    //console.log("###############################################")

    while(true){
        for(i = high - 1; i >= mid; i--){
            //console.log(localSymbols[i])
            await sleep(delay)
            actionForNormalSymbol("unsubscribe", localSymbols[i])
        }

        //console.log("###############################################")

        for(i = mid; i < high; i++){
            await sleep(delay)
            actionForNormalSymbol("subscribe", localSymbols[i])
        }
    }
}

mainLoop().then(()=>{})