const CommonUtils = require('../CommonUtils')
const api = require('../apiHandle')
const Event = CommonUtils.Event
const appSpecificErrors = require('../appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription
const DuplicateSubscription = appSpecificErrors.DuplicateSubscription

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
        this.normalSubscriptionBook = new Map()
        this.virtualSubscriptionBook = new Map()
    }

    async subscribe(symbol, callback){
        let evt = this.normalSubscriptionBook.get(symbol)

        if(undefined === evt){
            evt = new Event()
            this.normalSubscriptionBook.set(symbol, evt)
            await this.depthSubscriber(symbol, (depth)=>{
                this.onDepth(symbol, depth)
            })
        }

        evt.registerCallback(callback)  
    }

    async subscribeVirtual(asset, currency, bridge, callback){
        const symbol = this.virtualtradingPairNameGenerator(asset, currency, bridge)
        let evt = this.virtualSubscriptionBook.get(symbol)

        if(undefined === evt){
            evt = new Event()
            this.virtualSubscriptionBook.set(symbol, evt)
            await this.virtualDepthSubscriber(asset, currency, bridge, (depth)=>{
                this.onVirtualDepth(asset, currency, bridge, depth)
            })
        }

        evt.registerCallback(callback)
    }

    async unsubscribe(symbol, callback){
        const evt = this.normalSubscriptionBook.get(symbol)
        if(undefined !== evt){
            evt.unregisterCallback(callback)
            if(evt.empty()){
                this.normalSubscriptionBook.delete(symbol)
                await this.depthUnsubscriber(symbol)
            }
        }
        else
            throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
    }

    async unsubscribeVirtual(asset, currency, bridge, callback){
        const symbol = this.virtualtradingPairNameGenerator(asset, currency, bridge)
        const evt = this.virtualSubscriptionBook.get(symbol)

        if(undefined !== evt){
            evt.unregisterCallback(callback)
            if(evt.empty()){
                this.virtualSubscriptionBook.delete(symbol)
                await this.virtualDepthUnsubscriber(asset, currency, bridge)
            }
        }
        else
            throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
    }

    onDepth(symbol, depth){
        const evt = this.normalSubscriptionBook.get(symbol)
        if(undefined !== evt){
            evt.raise(depth)
        }
    }

    onVirtualDepth(asset, currency, bridge, depth){
        const symbol = this.virtualtradingPairNameGenerator(asset, currency, bridge)
        const evt = this.virtualSubscriptionBook.get(symbol)
        if(undefined !== evt){
            evt.raise(depth)
        }
    }
}

module.exports.SubscriptionHandler = SubscriptionHandler

