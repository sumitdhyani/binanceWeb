const prompt = require("prompt-async");
function clearAndPrint(str){
    console.clear()
    console.log(str)
}

function print(str){
    console.log(str)
}

let dataStore = new Map()

async function addData(key, callback){
    if(dataStore.has(key)){
        clearAndPrint(`Error! Key: ${key} is already there`)
        return
    }

    const promptText = "Enter the content for key"
    const data = (await prompt.get([promptText]))[promptText]
    dataStore.set(key, data)
    callback(dataStore)
}

async function removeData(key, callback){
    if(!dataStore.has(key)){
        clearAndPrint(`Error! Key: ${key} not found`)
        return
    }

    dataStore.delete(key)
    callback(dataStore)
}

async function updateData(key, callback){
    if(!dataStore.has(key)){
        clearAndPrint(`Error! Key: ${key} not found`)
        return
    }

    const promptText = "Enter the updated content for key"
    const data = (await prompt.get([promptText]))[promptText]
    dataStore.set(key, data)
    callback(dataStore)
}

async function displayData(key){
    if(!dataStore.has(key)){
        clearAndPrint(`Error! Key: ${key} not found`)
        return
    }

    clearAndPrint(`data for ${key} : ${dataStore.get(key)}`)
}

async function performNextAction(callback)
{
    prompt.start()
    const {action, key} = await prompt.get(["action", "key"])
    if(0 === action.localeCompare("add"))
        await addData(JSON.stringify(key), callback)
    else if(0 === action.localeCompare("delete"))
        await removeData(JSON.stringify(key), callback)
    else if(0 === action.localeCompare("update"))
        await updateData(JSON.stringify(key), callback)
    else if(0 === action.localeCompare("display"))
        await displayData(JSON.stringify(key))
    else
        await clearAndPrint("Invalid action!")
}

async function mainLoop(callback)
{
        clearAndPrint("Started console input")
        while(true)
            await performNextAction(callback)
}

//mainLoop((data) => { print('callback received')}).then(()=>{})
async function start(callback){
    mainLoop(callback).then(()=>{})
}

module.exports.start = start