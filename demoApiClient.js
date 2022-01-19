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

async function onAllSymbols(lump)
{
    console.log("All instruments received: ", JSON.stringify(lump))
}

async function actionForVirtualSymbol(action, asset, currency, bridge)
{
    if(0 == action.localeCompare("subscribe"))
    {
        try
        {
            api.subscribeVirtualPrice(asset, currency, bridge, onVirtualPrice)
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
            api.unsubscribeVirtualPrice(asset, currency, bridge, onVirtualPrice)
        }
        catch(err)
        {
            console.log(err)
        }
    }
}


async function actionForNormalSymbol(action, symbol)
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

async function mainLoop()
{
    api.downloadAllSymbols(onNewSymbol, ()=>{})
    api.downloadAllSymbolsInLump(onAllSymbols)
    while(true)
        await performNextAction()    
}

function onPrice(price)
{
    fs.appendFile("test.log", "Normal price recieved: ".concat(JSON.stringify(price)).concat("\n"), function(err) {
        if(err) {
            return console.log(err);
        }
    
        //console.log("The file was saved!");
    });
}


function onVirtualPrice(price)
{
    fs.appendFile("test.log", "Virtual price recieved: ".concat(JSON.stringify(price)).concat("\n"), function(err) {
        if(err) {
            return console.log(err);
        }
    
        //console.log("The file was saved!");
    });
}
//mainLoop().then(()=>{})
api.start("test", mainLoop, ['localhost:9092','127.0.0.1:9092']).then(()=>{})
