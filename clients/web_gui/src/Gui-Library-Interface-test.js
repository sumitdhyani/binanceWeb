const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual, subscribeBasket, unsubscribeBasket} = require('./Gui-Library-Interface')
const logger = {  debug : str =>console.log(str),
    info : (str) =>console.log(str),
    warn : (str) =>console.log(str),
    error : (str) =>console.log(str)
 }

 init({auth_server : ["http://165.232.187.129:90","http://143.244.139.3:90","http://143.244.131.67:90"], credentials : {user : "test_user", password : "test_pwd"}},
 //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
      logger,
      mainLoop)

function onUpdate(update){
    logger.debug(JSON.stringify(update))
}

function mainLoop(symbolDict){
    //symbolDict.forEach((item, key)=>{logger.debug(`Key: ${key}`)})
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

    function actionForBasket(params) {//(action, reqId, symbols, coefficients, currency, priceConverters, exchange){ 
        try{
            if(0 === params.action.localeCompare("subscribe")){
                subscribeBasket(params.reqId,
                                params.symbols,
                                params.coefficients,
                                params.currency,
                                params.priceConverters,
                                params.exchange,
                                onUpdate)
            }
            else{
                unsubscribeBasket(params.reqId)
            }
        }
        catch(err){
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

    const cyclicalFuncForBasket = (params) =>{//(reqId, symbols, coefficients, currency, priceConverters, exchange) =>{
        setTimeout(()=> {
            actionForBasket({...params, action: "subscribe"})
                setTimeout(()=>{
                    actionForBasket({reqId : params.reqId, action : "unsubscribe"})
                    cyclicalFuncForBasket(params)
                }, 10000)
        }, 5000)
    }
    
    const numInstruments = 2
    const allowedBridgeCurrency = "USDT"
    const filteredSymbols = [...symbolDict.values()].filter( obj=> 0 === obj.quoteAsset.localeCompare(allowedBridgeCurrency))
    for(let i = 0; i < numInstruments; i++){
        //cyclicalFunc(filteredSymbols[i].symbol)
        //cyclicalFuncForVirtual(filteredSymbols[i].baseAsset, filteredSymbols[i+1].baseAsset, allowedBridgeCurrency)
        let reqId = filteredSymbols[i].symbol.concat(filteredSymbols[i+1].symbol)
        const returnAsItIs = (price) => { return price }
        cyclicalFuncForBasket({
                                reqId : reqId,
                                symbols : [filteredSymbols[i].symbol, filteredSymbols[i+1].symbol],
                                coefficients: [3,2],
                                currency: "USDT",
                                priceConverters: [returnAsItIs, returnAsItIs],
                                exchange: "BINANCE"}
        )
    }
}   