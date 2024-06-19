const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const Event = CommonUtils.Event
const appSpecificErrors = require('../IndependentCommonUtils/appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription

class SubscriptionHandler
{
    constructor(depthSubscriber, 
                depthUnsubscriber,
                virtualDepthSubscriber,
                virtualDepthUnsubscriber,
                virtualtradingPairNameGenerator,
                logger
                ){
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.virtualDepthSubscriber = virtualDepthSubscriber
        this.virtualDepthUnsubscriber = virtualDepthUnsubscriber
        this.virtualtradingPairNameGenerator = virtualtradingPairNameGenerator
        this.logger = logger
        this.subscriptionBook = new Map()
    }

    async subscribe(symbol, exchange, type, callback){
        const key = JSON.stringify([symbol, exchange, type])
        let evt = this.subscriptionBook.get(key)

        if(undefined === evt){
            evt = new Event()
            this.subscriptionBook.set(key, evt)
            await this.depthSubscriber(symbol, exchange, type, (update, raw)=>{
                this.onDepth(symbol, exchange, type, update, raw)
            })
        }

        evt.registerCallback(callback)  
    }

    async unsubscribe(symbol, exchange, type, callback){
        const key = JSON.stringify([symbol, exchange])
        const evt = this.subscriptionBook.get(key)
        if(undefined !== evt){
            evt.unregisterCallback(callback)
            if(evt.empty()){
                this.subscriptionBook.delete(key)
                await this.depthUnsubscriber(symbol, exchange, type)
            }
        }
        else
            throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
    }

    onDepth(symbol, exchange, type, depth, raw){
        this.logger.debug(`Recd update in SubscriptionHandler.js`)
        const key = JSON.stringify([symbol, exchange, type])
        const evt = this.subscriptionBook.get(key)
        if(undefined !== evt){
            this.logger.debug(`Found evt in SubscriptionHandler.js`)
            evt.raise(depth, raw)
        }
    }
}

module.exports.SubscriptionHandler = SubscriptionHandler

