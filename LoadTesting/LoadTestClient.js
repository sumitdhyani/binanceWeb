const winston = require('winston')
const { launch, subUnsub } = require('../ClientLayerLibrary/ClientInterface')
const prompt = require("prompt-async");
const fs = require('fs');
const readline = require('readline');
const CommonUtils = require("../CommonUtils")
const lockfile = require('proper-lockfile')
const symbolDict = new Map()

logger = CommonUtils.createFileLogger("LoadTestClient", 'warn')
let msgTotal = 0
const testRunDuration = parseInt(process.argv[6]) * 1000

function sleep(ms) {
    if(0 < ms)
        return

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        //console.log("Done waiting");
        resolve(ms)
      }, ms )
    })
}  

async function loadSymbols() {
    const fileStream = fs.createReadStream('symbols.txt')

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
    msgTotal++
    //console.log(`Received data: ${JSON.stringify(data)}`)
}

launch({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}}, onData, (msg)=>{logger.debug(msg)})

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

process.on('SIGINT', ()=> {
    console.log('SIGINT received...')
    process.exit()
});

process.on('SIGTERM', ()=> {
    console.log('SIGTERM received...')
    process.exit()
});

process.on('SIGKILL', ()=> {
    console.log('SIGKILL received...')
    process.exit()
});

//This is the entry point of the application, this method is passed to the start method as you will see below
async function mainLoop()
{
    low = parseInt(process.argv[2])
    mid = parseInt(process.argv[3])
    high = parseInt(process.argv[4])
    delay = parseInt(process.argv[5])

    let msgTotalPrevInterval = 0
    let numIntervals = 0;
    const interval = 1000
    const localSymbols = []
    await loadSymbols()
    let i = 0
    for(const [symbol, obj] of symbolDict){
        localSymbols.push(symbol)
        if(++i == high){
            break
        }
    }

    let statBook = []
    symbolDict.clear()
    let totalMessages = 0

    setTimeout(()=>{
        for(let symbol of localSymbols){
            actionForNormalSymbol("unsubscribe", symbol)
            sleep(delay)
        }
        
        let min = 1000000
        let max = 0
        for(let [numMessages, time] of statBook){
            if(numMessages > max){
                max = numMessages
            }

            if(numMessages < min){
                min = numMessages
            }

            totalMessages += numMessages
        }

        (freqBook = []).length = max + 1
        freqBook.fill(0)
        for(let [numMessages, time] of statBook){
            freqBook[numMessages]++
        }

        let maxFreq = 0
        let mode = 0
        for(let i = 0; i < freqBook.length; i++){
            if(freqBook[i] > maxFreq){
                maxFreq = freqBook[i]
                mode = i
            }
        }

        statBook.sort((n1, n2) => n1[0] - n2[0])
        let median = 0
        if(statBook.length % 2 == 1){
            median = statBook[Math.floor(statBook.length/2)][0]
        }
        else{
            median = (statBook[Math.floor(statBook.length / 2)][0] +
                      statBook[Math.floor(statBook.length - 1 / 2)][0]) / 2
        }

        const mean = totalMessages / statBook.length
        const summary = { duration : statBook.length,
                          totalMessagesRecd : totalMessages,
                          high : max,
                          low : min,
                          mean : mean,
                          median : median,
                          mode : mode//,
                          //statBook : statBook,
                          //freqBook : freqBook,
        }
        
        //console.log(`summary : ${JSON.stringify(summary)}`)
        const func = ()=>{
            lockfile.lock('loadtest.lock').
            then((release)=>{
                const str = JSON.stringify(summary) + "\n"
                console.log(`${process.pid}: Lock taken`)
                fs.appendFileSync("loadTestReport.txt", str)
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

    setInterval(()=>{
                        numIntervals++
                        const totalThroughPut = msgTotal/numIntervals
                        msgThisInterval =  msgTotal - msgTotalPrevInterval
                        msgTotalPrevInterval = msgTotal
                        statBook.push([msgThisInterval, Math.floor(Date.now() / 1000)])
                        logger.debug(`Interval length(ms): ${interval} Total: ${msgTotal}, this interval throughput: ${msgThisInterval}, net throughput: ${totalThroughPut}`)
                    }, 
                interval)
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

mainLoop().then(()=>{})