class SpuriousUnsubscription extends Error{
    constructor(message = "Unsubscription on a non-existent subscription"){
        super(message)
        this.name = "SpuriousUnsubscription"
    }
}

class DuplicateSubscription extends Error{
    constructor(message = "Duplicate subscription received"){
        super(message)
        this.name = "DuplicateSubscription"
    }
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

    validateCallbackStructure(callback){
        if(callback.length >= this.evtListeneters.length)
            throw new Error(`The callback should have max ${this.evtListeneters.length - 1} params`)
    }

    validateEventArgs(args){
        if(args.length >= this.evtListeneters.length)
            throw new Error(`The event reaise should have max ${this.evtListeneters.length - 1} params`)
    }

    registerCallback(callback)
    {
        this.validateCallbackStructure(callback)
        if(this.evtListeneters[callback.length].has(callback)){
            throw new DuplicateSubscription("This callback is already registered")
        }
        this.evtListeneters[callback.length].add(callback)
    }

    unregisterCallback(callback)
    {
        this.validateCallbackStructure(callback)
        if(!this.evtListeneters[callback.length].delete(callback)){
            throw new SpuriousUnsubscription("This callback was never registered")
        }
    }

    raise(...args)
    {
        this.validateEventArgs(args)
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
class SubscriptionHandler
{
    constructor(depthSubscriber, 
                depthUnsubscriber,
                logger){
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.logger = logger
        this.subscriptionBook = new Map()
    }

    subscribe(symbol, exchange, callback){
        const key = JSON.stringify([symbol, exchange])
        let evt = this.subscriptionBook.get(key)

        if(undefined === evt){
            evt = new Event()
            this.subscriptionBook.set(key, evt)
            this.depthSubscriber(symbol, exchange)
        }

        evt.registerCallback(callback) 
    }

    unsubscribe(symbol, exchange, callback){
        const key = JSON.stringify([symbol, exchange])
        const evt = this.subscriptionBook.get(key)
        if(undefined !== evt){
            evt.unregisterCallback(callback)
            if(evt.empty()){
                this.subscriptionBook.delete(key)
                this.depthUnsubscriber(symbol, exchange)
            }
        }
        else
            throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
    }

    onUpdate(update){
        update = JSON.parse(update)
        const key = JSON.stringify([update.symbol, update.exchange])
        const evt = this.subscriptionBook.get(key)
        if(undefined !== evt){
            evt.raise(update)
        }
    }
}

module.exports.SubscriptionHandler = SubscriptionHandler

