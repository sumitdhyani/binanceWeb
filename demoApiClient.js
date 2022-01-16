// const { Console } = require("console");
// const { runMain } = require("module");
// process = require('process')
// input = process.stdin
// output = process.stdout

api = require("./apiHandle.js");
fs = require('fs');
const prompt = require("prompt-async");

async function performNextAction()
{
    prompt.start()
    const {action, symbol} = await prompt.get(["action", "symbol"])
    if(0 != action.localeCompare("quit"))
    {
        if(0 == action.localeCompare("subscribe"))
        {
            api.subscribePrice(symbol, onPrice)
        }
        else
            api.unsubscribePrice(symbol, onPrice)
    }
}

async function mainLoop()
{
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
