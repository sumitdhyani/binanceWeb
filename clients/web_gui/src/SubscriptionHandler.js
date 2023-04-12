const CommonUtils = require('./root/CommonUtils')
const Event = CommonUtils.Event
const appSpecificErrors = require('./root/appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription

class SubscriptionHandler
{
    constructor(depthSubscriber, 
                depthUnsubscriber,
                logger
                ){
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
            this.depthSubscriber(symbol, exchange, (depth)=>{
                this.onDepth(symbol, exchange, depth)
            })
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

