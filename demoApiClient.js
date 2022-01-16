// const { Console } = require("console");
// const { runMain } = require("module");
// process = require('process')
// input = process.stdin
// output = process.stdout

api = require("./apiHandle.js");
fs = require('fs');
const prompt = require("prompt-async");

async function onNewSymbol(symbolDetails)
{
    console.log("New instrument received: ", JSON.stringify(symbolDetails))
}

async function performNextAction()
{
    prompt.start()
    const {action, symbol} = await prompt.get(["action", "symbol"])
    if(0 != action.localeCompare("quit"))
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
}

async function mainLoop()
{
    api.downloadAllSymbols(onNewSymbol, ()=>{})
    while(true)
        await performNextAction()    
}

function onPrice(price)
{
    fs.appendFile("test.log", JSON.stringify(price).concat("\n"), function(err) {
        if(err) {
            return console.log(err);
        }
    
        //console.log("The file was saved!");
    });
}

//mainLoop().then(()=>{})
api.start("test", mainLoop, ['localhost:9092','127.0.0.1:9092']).then(()=>{})
