const CommonUtils = require('./root/CommonUtils')
const Event = CommonUtils.Event
const appSpecificErrors = require('./root/appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription

class VirtualSubscriberUnit{
    constructor(assetSideExchangeSymbol,
                currencySideExchangeSymbol,
                callback,
                depthSubscriber,
                depthUnsubscriber,
                ){
        this.subscriptionBook = new Map()
        this.evt = new Event()
        levels = {bids: null, asks : null}
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.assetSideExchangeSymbol = assetSideExchangeSymbol
        this.currencySideExchangeSymbol = currencySideExchangeSymbol
        evt.registerCallback(callback)
        this.depthSubscriber(assetSideExchangeSymbol, this.onAssetSideUpdate)
        this.depthSubscriber(currencySideExchangeSymbol, this.onCurrencySideUpdate)
    }

    onAssetSideUpdate(update){
        //calculation logic here
        this.evt.raise(levels)
    }

    onCurrencySideUpdate(update){
        //calculation logic here
        this.evt.raise(levels)
    }

    addSubscriber(callback){
        this.evt.registerCallback(callback)
    }

    removeSubscriber(callback){
        this.evt.unregisterCallback(callback)
        if (this.evt.empty()){
            this.depthUnsubscriber(assetSideExchangeSymbol, this.onAssetSideUpdate)
            this.depthUnsubscriber(currencySideExchangeSymbol, this.onCurrencySideUpdate)
        }
    }

    empty(){
        return this.evt.empty()
    }
}

class VirtualSubscriptionHandler
{
    constructor(depthSubscriber, 
                depthUnsubscriber,
                logger){
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.logger = logger
        this.subscriptionBook = new Map()
    }

    subscribe(asset, currency, bridge, exchange, callback, exchangeSymbolNameGenerator){
        const key = JSON.stringify([asset, currency, bridge, exchange])
        const virtualSubscriberUnit = this.subscriptionBook.get(key)
        if(undefined === virtualSubscriberUnit){
            this.subscriptionBook.set(key, new VirtualSubscriberUnit(exchangeSymbolNameGenerator(asset, bridge, exchange),
                                                                     exchangeSymbolNameGenerator(currency, bridge, exchange),
                                                                     callback,
                                                                     (symbol, callback) => this.depthSubscriber(symbol, exchange, callback),
                                                                     (symbol, callback) => this.depthUnsubscriber(symbol, exchange, callback)))
        }
        else{
            virtualSubscriberUnit.addSubscriber(callback)
        }
    }

    unsubscribe(asset, currency, bridge, exchange, callback){
        const key = JSON.stringify([asset, currency, bridge, exchange])
        const virtualSubscriberUnit = this.subscriptionBook.get(key)
        if(undefined !== virtualSubscriberUnit){
            virtualSubscriberUnit.removeSubscriber(callback)
            if (virtualSubscriberUnit.empty()){
                this.subscriptionBook.delete(key)
            }
        }
        else
            throw new SpuriousUnsubscription(`The key ${JSON.stringify(key)} is not currently subscribed`)
    }
}

module.exports.VirtualSubscriptionHandler = VirtualSubscriptionHandler