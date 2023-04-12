//const prompt = require("prompt-async");
const { launch, raise_request, download_instruments} = require('./root/ClientLayerLibrary/ClientInterface')
let dataStore = new Map()



const logger = {
    debug : str =>console.log(str),
    info : str =>console.log(str),
    warn : str =>console.log(str),
    error : str =>console.log(str)
}

function onData(data, callback){
    let update = JSON.parse(data)
    dataStore.set(JSON.stringify([update.symbol, update.exchange]), update)
    callback(dataStore)
}

function actionForNormalSymbol(action, symbol){
    try{
        raise_request({action : action,
                symbol : symbol,
                exchange : "BINANCE"})
    }
    catch(err){
        let temp = new Error()
        logger.warn(`Error while ${action} for ${symbol}, details: ${err.message}, stack: ${temp.stack}`)
    }
}

async function mainLoop(symbolDict, callback){
    launch({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}}, (update)=> onData(update, callback), logger)   
    let numInstruments = 10
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
    for(const [symbol, obj] of symbolDict){
        cyclicalFunc(JSON.parse(symbol)[0])
        if(++i === numInstruments){
            break
        }
    }
}

const start = (callback)=>download_instruments()
.then((dict)=>{
    mainLoop(dict, callback).then(()=>{})
})

//function makeid(length) {
//    let result = '';
//    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//    const charactersLength = characters.length;
//    let counter = 0;
//    while (counter < length) {
//      result += characters.charAt(Math.floor(Math.random() * charactersLength));
//      counter += 1;
//    }
//    return result;
//}
//
//async function start(callback){
//    console.log(`Loop started`)
//    setInterval(()=>{
//        dataStore.set(Math.floor(Math.random()*10) % 5, makeid(50))
//        callback(dataStore)
//    }, 1000)
//}

export default start