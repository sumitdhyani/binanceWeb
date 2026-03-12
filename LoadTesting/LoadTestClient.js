const winston = require('winston')
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual, subscribeBasket, unsubscribeBasket} = require('../frontEnd/app/root/Gui-Library-Interface')
const prompt = require("prompt-async");
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("../CommonUtils")
const lockfile = require('proper-lockfile');
const path = require('path');
const { uptime } = require('os');

const logger = CommonUtils.createFileLogger(path.join(__dirname, "logs.txt"), 'debug')
let numDisconnections = -1
let msgTotal = 0
let msgThisInterval = 0
let firstReceiveInterval = -1
let numIntervals = 0
const testRunDuration = parseInt(process.argv[6]) * 1000
let uniqueSymbolsRecd = new Set()
let latency_array = []
function sleep(ms) {
    if(ms <= 0)
        return

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        //console.log("Done waiting");
        resolve(ms)
      }, ms )
    })
}

function calcMinMax(arr){
    if(0 == arr.length){
        return [-1, -1]
    }
    
    return arr.reduce((prev, item)=>{
        let [currMin, currMax] = prev
        return[item < currMin? item : currMin,
               currMax < item? item : currMax]
    }, [1000000, 0])
}

function calcAverage(arr){
    if(0 == arr.length){
        return 0
    }
    
    return arr.reduce((prev, item)=>{
        return prev + item
    }, 0)/arr.length
}

function calcMedian(arr){
    if(0 == arr.length){
        return 0
    }
    
    arrCopy = JSON.parse(JSON.stringify(arr));
    arrCopy.sort((n1, n2) => n1 - n2)
    const len = arrCopy.length
    if(len % 2 == 1){
        return arrCopy[Math.floor(len/2)]
    }
    else{
        return (arrCopy[Math.floor(len / 2)] +
                arrCopy[Math.floor(len / 2) - 1]) / 2
    }
}

function calcMode(arr){
    if(0 === arr.length){
        return [0, []]
    }
    
    let [min, max] = calcMinMax(arr)
    let freqBook = []
    freqBook.length = max + 1
    freqBook.fill(0)
    res = arr.reduce((prev, item)=>{
        let [prevFreq, prevModes] = prev
        freqBook[item]++
        let thisItemsFreq = freqBook[item]
        if(0 == prevModes.size ||
           (thisItemsFreq == prevFreq)) {
            prevModes.add(item)
            return [thisItemsFreq, prevModes]
        }else if(thisItemsFreq > prevFreq) {
            return [thisItemsFreq, new Set([item])]
        }else {
            return [prevFreq, prevModes]
        }
    }, [0, new Set()])

    return [res[0], Array.from(res[1])]
}

function onData(dict){
    let timestamps = dict["timestamps"]
    

    if(undefined !== timestamps){
        const arrivalTime = dict._arrivalTime || Date.now()
        latency_array.push(arrivalTime - timestamps[0])
    }
    
    if(dict["message_type"].localeCompare("disconnection") == 0){
        numDisconnections++
        return
    }

    //console.log(JSON.stringify(dict))
    //logger.warn(dict["symbol"])
    uniqueSymbolsRecd.add(dict["symbol"])
    msgTotal++
    msgThisInterval++
    if( -1 == firstReceiveInterval){
        firstReceiveInterval = numIntervals
    }
    //console.log(`Received data: ${JSON.stringify(data)}`)
}

async function actionForNormalSymbol(action, symbol)
{
    try{
        0 == action.localeCompare("subscribe")?
             subscribe(symbol, "FAKEX", "depth", onData):
             unsubscribe(symbol, "FAKEX", "depth", onData);

    }
    catch(err){
        let temp = new Error()
        logger.warn(`Error while ${action} for ${symbol}, details: ${err.message}, stack: ${temp.stack}`)
    }
}

process.on('SIGINT', ()=> {
    console.log('SIGINT received...')
    process.exit()
});

process.on('SIGTERM', ()=> {
    console.log('SIGTERM received...')
    process.exit()
});

//This is the entry point of the application, this method is passed to the start method as you will see below
async function mainLoop(symbolDict)
{
    const allowed_instruments = symbolDict.allowed_instruments
    low = parseInt(process.argv[2])
    mid = parseInt(process.argv[3])
    high = parseInt(process.argv[4])
    delay = parseInt(process.argv[5])

    console.log(`low: ${low}, mid: ${mid}, high: ${high}, delay: ${delay}, testDuration: ${testRunDuration}`)

    const interval = 1000
    const localSymbols = []
    let i = 0
    for(const [symbol, obj] of allowed_instruments){
        localSymbols.push(JSON.parse(symbol)[0])
        if(++i == high){
            break
        }
    }

    let statBook = []
    //symbolDict.clear()

    let intervalId = setInterval(()=>{
        numIntervals++
        const totalThroughPut = msgTotal/numIntervals
        statBook.push([msgThisInterval, Math.floor(Date.now() / 1000)])
        logger.debug(`Interval length(ms): ${interval} Total: ${msgTotal}, this interval throughput: ${msgThisInterval}, net throughput: ${totalThroughPut}`)
        msgThisInterval = 0
    }, interval)

    setTimeout(()=>{
        clearInterval(intervalId)
        
        //min and max
        let throughputArr = statBook.map(item=> item[0])
        const summary = { duration : statBook.length,
                          totalMessagesRecd : msgTotal,
                          throughput : {low_high : calcMinMax(throughputArr),
                                        mean : calcAverage(throughputArr),
                                        median : calcMedian(throughputArr),
                                        mode : calcMode(throughputArr)},
                          unique_symbols : uniqueSymbolsRecd.size,
                          numDisconnections : numDisconnections,
                          firstReceiveInterval : firstReceiveInterval,
                          up_time : process.uptime(),
                          latency : {low_high : calcMinMax(latency_array),
                                     mean : calcAverage(latency_array),
                                     median : calcMedian(latency_array)},
                          latency_array : latency_array
                          //freqBook : freqBook,
        }
        
        //console.log(`summary : ${JSON.stringify(summary)}`)
        const lockPath = path.join(__dirname, 'loadtest.lock')
        const reportPath = path.join(__dirname, 'report.txt')
        if (!fs.existsSync(lockPath)) {
            fs.writeFileSync(lockPath, '')
        }
        const func = ()=>{
            lockfile.lock(lockPath).
            then((release)=>{
                const str = JSON.stringify(summary) + "\n"
                console.log(`${process.pid}: Lock taken`)
                fs.appendFileSync(reportPath, str)
                release()
                process.exit()
            }).
            catch((err)=>{
                console.log(`${process.pid}: ${err.message}` )
                if(0 == err.message.localeCompare(`Lock file is already being held`)){
                    console.log(`${process.pid}: Retrying to take the log`)
                    func()
                }
            })
            //.
            //finally(()=>{
            //    process.exit()
            //})
        }

        func()
        
    }, testRunDuration)

    
    for(i = 0; i < high; i++){
        //console.log(localSymbols[i])
        await sleep(delay)
        actionForNormalSymbol("subscribe", localSymbols[i])
    }

    //console.log("###############################################")

    if(low < mid && mid < high){
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
}

console.log("Starting")

init({auth_server : ["https://web.sd-projects.uk"],
      credentials : {user : "test_user", password : "test_pwd"}},
 //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
      logger,
      mainLoop)
