const CommonUtils = require('./root/CommonUtils')
const Event = CommonUtils.Event
const appSpecificErrors = require('./root/appSpecificErrors')
const SpuriousUnsubscription = appSpecificErrors.SpuriousUnsubscription

class VirtualSubscriberUnit{
    constructor(asset,
                currency,
                bridge,
                exchange,
                assetSideExchangeSymbol,
                currencySideExchangeSymbol,
                depthSubscriber,
                depthUnsubscriber,
                logger){
        this.asset = asset
        this.currency = currency
        this.bridge = bridge
        this.logger = logger
        this.exchange = exchange
        this.subscriptionBook = new Map()
        this.evt = new Event()
        this.assetBestBidAsk = null
        this.currencyBestBidAsk = null
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.assetSideExchangeSymbol = assetSideExchangeSymbol
        this.currencySideExchangeSymbol = currencySideExchangeSymbol
    }

    onAssetSideUpdate(update){
        this.assetBestBidAsk = [update.bids[0], update.asks[0]]
        if(null === this.currencyBestBidAsk){
            return
        }
        this.raisePriceUpdateEvt()
    }

    onCurrencySideUpdate(update){
        this.currencyBestBidAsk = [update.bids[0], update.asks[0]]
        if(null === this.assetBestBidAsk){
            return
        }
        this.raisePriceUpdateEvt()
    }

    raisePriceUpdateEvt(){
        let [assetBestBidLevel , assetBestAskLevel] = this.assetBestBidAsk
        let [currencyBestBidLevel , currencyBestAskLevel] = this.currencyBestBidAsk
        let [assetBestBP, assetBestBQ] = assetBestBidLevel
        let [assetBestAP, assetBestAQ] = assetBestAskLevel
        let [currencyBestBP, currencyBestBQ] = currencyBestBidLevel
        let [currencyBestAP, currencyBestAQ] = currencyBestAskLevel

        let bidLevel = [assetBestAP/currencyBestBP, assetBestAQ]
        let askLevel = [assetBestBP/currencyBestAP, currencyBestAQ]

        this.evt.raise({asset : this.asset, 
                        currency : this.currency,
                        bridge : this.bridge,
                        exchange : this.exchange,
                        bids :  [bidLevel],
                        asks : [askLevel]})
    }

    addSubscriber(callback){
        if(this.empty()){
            console.log(`FuncName: ${this.onAssetSideUpdate}`)
            this.depthSubscriber(this.assetSideExchangeSymbol, this.onAssetSideUpdate)
            this.depthSubscriber(this.currencySideExchangeSymbol, this.onCurrencySideUpdate)
        }
        this.evt.registerCallback(callback)
    }

    removeSubscriber(callback){
        this.evt.unregisterCallback(callback)
        if (this.empty()){
            this.depthUnsubscriber(this.assetSideExchangeSymbol, this.onAssetSideUpdate)
            this.depthUnsubscriber(this.currencySideExchangeSymbol, this.onCurrencySideUpdate)
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
        let virtualSubscriberUnit = this.subscriptionBook.get(key)
        if(undefined === virtualSubscriberUnit){
            virtualSubscriberUnit = new VirtualSubscriberUnit(asset,
                                                              currency,
                                                              bridge,
                                                              exchange,
                                                              exchangeSymbolNameGenerator(asset, bridge, exchange),
                                                              exchangeSymbolNameGenerator(currency, bridge, exchange),
                                                              (symbol, callback) => this.depthSubscriber(symbol, exchange, callback),
                                                              (symbol, callback) => this.depthUnsubscriber(symbol, exchange, callback),
                                                              this.logger)

            this.subscriptionBook.set(key, virtualSubscriberUnit)
            
        }

        virtualSubscriberUnit.addSubscriber(callback)
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