const {createLogger, format, transports} = require('winston')
const {combine, timestamp, label, printf} = format
const appSpecificErrors = require('./appSpecificErrors')

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

class Event
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
            throw new Error(`The callback should have max ${this.evtListeneters.length - 1} params`)
    }

    #validateEventArgs(args){
        if(args.length >= this.evtListeneters.length)
            throw new Error(`The event reaise should have max ${this.evtListeneters.length - 1} params`)
    }

    registerCallback(callback)
    {
        this.#validateCallbackStructure(callback)
        if(this.evtListeneters[callback.length].has(callback)){
            throw new appSpecificErrors.DuplicateSubscription("This callback is already registered")
        }
        this.evtListeneters[callback.length].add(callback)
    }

    unregisterCallback(callback)
    {
        this.#validateCallbackStructure(callback)
        if(!this.evtListeneters[callback.length].delete(callback)){
            throw new appSpecificErrors.SpuriousUnsubscription("This callback was never registered")
        }
    }

    raise(...args)
    {
        this.#validateEventArgs(args)
        this.evtListeneters[args.length].forEach(callback => {
            callback(...args)
        })
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
module.exports.Event = Event
