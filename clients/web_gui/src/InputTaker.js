//const prompt = require("prompt-async");
//function clearAndPrint(str){
//    console.clear()
//    console.log(str)
//}
//
//function print(str){
//    console.log(str)
//}
//
//let dataStore = new Map()
//
//async function addData(key, callback){
//    if(dataStore.has(key)){
//        clearAndPrint(`Error! Key: ${key} is already there`)
//        return
//    }
//
//    const promptText = "Enter the content for key"
//    const data = (await prompt.get([promptText]))[promptText]
//    dataStore.set(key, data)
//    callback(dataStore)
//}
//
//async function removeData(key, callback){
//    if(!dataStore.has(key)){
//        clearAndPrint(`Error! Key: ${key} not found`)
//        return
//    }
//
//    dataStore.delete(key)
//    callback(dataStore)
//}
//
//async function updateData(key, callback){
//    if(!dataStore.has(key)){
//        clearAndPrint(`Error! Key: ${key} not found`)
//        return
//    }
//
//    const promptText = "Enter the updated content for key"
//    const data = (await prompt.get([promptText]))[promptText]
//    dataStore.set(key, data)
//    callback(dataStore)
//}
//
//async function displayData(key){
//    if(!dataStore.has(key)){
//        clearAndPrint(`Error! Key: ${key} not found`)
//        return
//    }
//
//    clearAndPrint(`data for ${key} : ${dataStore.get(key)}`)
//}
//
//async function performNextAction(callback)
//{
//    prompt.start()
//    const {action, key} = await prompt.get(["action", "key"])
//    if(0 === action.localeCompare("add"))
//        await addData(JSON.stringify(key), callback)
//    else if(0 === action.localeCompare("delete"))
//        await removeData(JSON.stringify(key), callback)
//    else if(0 === action.localeCompare("update"))
//        await updateData(JSON.stringify(key), callback)
//    else if(0 === action.localeCompare("display"))
//        await displayData(JSON.stringify(key))
//    else
//        await clearAndPrint("Invalid action!")
//}
//
//async function mainLoop(callback)
//{
//        clearAndPrint("Started console input")
//        while(true)
//            await performNextAction(callback)
//}
//
////mainLoop((data) => { print('callback received')}).then(()=>{})
//async function start(callback){
//    mainLoop(callback).then(()=>{})
//}

let dataStore = new Map()

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

async function start(callback){
    console.log(`Loop started`)
    setInterval(()=>{
        dataStore.set(Math.floor(Math.random()*10) % 5, makeid(50))
        callback(dataStore)
    }, 1000)
}

export default start