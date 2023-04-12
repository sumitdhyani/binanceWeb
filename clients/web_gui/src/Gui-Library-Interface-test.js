const {init, subscribe, unsubscribe} = require('./Gui-Library-Interface')
const logger = {  debug : str =>console.log(str),
    info : str =>console.log(str),
    warn : str =>console.log(str),
    error : str =>console.log(str)
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
            if(0 == action.localeCompare("subscribe")){
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

    const cyclicalFunc = (symbol)=>{
        setTimeout(()=> {
            actionForNormalSymbol("subscribe", symbol)
            setTimeout(()=>{
                actionForNormalSymbol("unsubscribe", symbol)
                cyclicalFunc(symbol)
            }, 10000)
        }, 5000)
    }

    let i = 0
    const numInstruments = 10
    logger.debug(JSON.stringify(symbolDict))
    for(const [symbol, obj] of symbolDict){
        cyclicalFunc(JSON.parse(symbol)[0])
        if(++i === numInstruments){
            break
        }
    }
}   