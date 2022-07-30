const {createLogger, format, transports} = require('winston')
const {combine, timestamp, label, printf} = format

const logFormat = printf(({level, message, timestamp}) => {
    return `${timestamp} ${level}: ${message}`
})

function createFileLogger(file){
    return createLogger({
        //format : winston.format.simple(),
        format : combine(format.colorize(), 
                         timestamp({format : 'YYYY-MM-DD HH:mm:ss'}),
                         logFormat),
        transports : [new transports.File({filename: file})]
    })
}

class AsyncEvent
{
    constructor(){
        //Callbacks upto 4 params are supported
        this.evtListeneters = [new Set(), 
                               new Set(), 
                               new Set(), 
                               new Set(), 
                               new Set()]
    }

    #validateCallbackStructure(callback){
        if(callback.length >= this.evtListeneters.length)
            throw Error(`The callback should have max ${this.evtListeneters.length - 1} params`)
    }

    #validateEventArgs(args){
        if(args.length >= this.evtListeneters.length)
            throw Error(`The event reaise should have max ${this.evtListeneters.length - 1} params`)
    }

    registerCallback(callback)
    {
        this.#validateCallbackStructure(callback)
        if(this.evtListeneters[callback.length].has(callback)){
            throw Error("This callback is already registered")
        }
        this.evtListeneters[callback.length].add(callback)
    }

    unregisterCallback(callback)
    {
        this.#validateCallbackStructure(callback)
        if(!this.evtListeneters[callback.length].delete(callback)){
            throw Error("This callback was never registered")
        }
    }

    async raise(...args)
    {
        this.#validateEventArgs(args)
        const coroutines = []
        this.evtListeneters[args.length].forEach(callback => {
            coroutines.push(callback())
        })
        
        await Promise.all(coroutines)
    }

    empty(){
        for(let idx = 0; idx < this.evtListeneters.length; idx++){
            if(this.evtListeneters[idx].size > 0){
                return false;
            }
        }
        return true
    }
}

module.exports.createFileLogger = createFileLogger
module.exports.AsyncEvent = AsyncEvent
