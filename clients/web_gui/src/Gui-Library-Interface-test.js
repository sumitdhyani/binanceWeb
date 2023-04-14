const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./Gui-Library-Interface')
const logger = {  debug : str =>console.log(str),
    info : (str) =>console.log(str),
    warn : (str) =>console.log(str),
    error : (str) =>console.log(str)
 }

init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
     logger,
     mainLoop)

function onUpdate(update){
    logger.debug(JSON.stringify(update))
}

function mainLoop(symbolDict){
    function actionForNormalSymbol(action, symbol){
        try{
            if(0 === action.localeCompare("subscribe")){
                subscribe(symbol, "BINANCE", onUpdate)
            }
            else{
                unsubscribe(symbol, "BINANCE", onUpdate)
            }
        }
        catch(err){
            logger.warn(`Error while ${action} for ${symbol}, details: ${err.message}`)
        }
    }

    function actionForVirtualSymbol(action, asset, currency, bridge){
        try{
            if(0 === action.localeCompare("subscribe")){
                subscribeVirtual(asset, currency, bridge, "BINANCE", onUpdate)
            }
            else{
                unsubscribeVirtual(asset, currency, bridge, "BINANCE", onUpdate)
            }
        }
        catch(err){
            logger.warn(`Error while ${action} for ${JSON.stringify([asset, currency, bridge, "BINANCE"])}, details: ${err.message}`)
        }
    }

    const cyclicalFunc = (symbol)=>{
        setTimeout(()=> {
            actionForNormalSymbol("subscribe", symbol)
            setTimeout(()=>{
                actionForNormalSymbol("unsubscribe", symbol)
                cyclicalFunc(symbol)
            }, 10000)
        }, 5000)
    }

    const cyclicalFuncForVirtual = (asset, currency, bridge)=>{
        setTimeout(()=> {
            actionForVirtualSymbol("subscribe", asset, currency, bridge)
            setTimeout(()=>{
                actionForVirtualSymbol("unsubscribe", asset, currency, bridge)
                cyclicalFuncForVirtual(asset, currency, bridge)
            }, 10000)
        }, 5000)
    }
    
    const numInstruments = 2
    const allowedBridgeCurrency = "USDT"
    const filteredSymbols = [...symbolDict.values()].filter( obj=> 0 === obj.quoteAsset.localeCompare(allowedBridgeCurrency))
    for(let i = 0; i < numInstruments; i++){
        cyclicalFunc(filteredSymbols[i].symbol)
        cyclicalFuncForVirtual(filteredSymbols[i].baseAsset, filteredSymbols[i+1].baseAsset, allowedBridgeCurrency)
    }
}   