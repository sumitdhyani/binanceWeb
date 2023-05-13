const CommonUtils = require('./root/IndependentCommonUtils/CommonUtils')
const appSpecificErrors = require('./root/IndependentCommonUtils/appSpecificErrors')
const [SpuriousUnsubscription, DuplicateSubscription] = [appSpecificErrors.SpuriousUnsubscription, appSpecificErrors.DuplicateSubscription]
const Event = CommonUtils.Event

class VirtualSubscriberUnit{
    constructor(depthSubscriber,
                depthUnsubscriber,
                staticInfo,
                logger,
                assetSideExchangeSymbol,
                currencySideExchangeSymbol,
                callback){
        this.logger = logger
        this.assetBestBidAsk = null
        this.currencyBestBidAsk = null
        this.staticInfo = staticInfo

        const onAssetSideUpdate = (update)=>{
            this.assetBestBidAsk = [update.bids[0], update.asks[0]]
            if(null === this.currencyBestBidAsk){
                return
            }
            this.raisePriceUpdateEvt()
        }

        const onCurrencySideUpdate = (update)=>{
            this.currencyBestBidAsk = [update.bids[0], update.asks[0]]
            if(null === this.assetBestBidAsk){
                return
            }
            this.raisePriceUpdateEvt()
        }

        this.unsubscribeDepths = ()=>{
            depthUnsubscriber(assetSideExchangeSymbol, onAssetSideUpdate)
            depthUnsubscriber(currencySideExchangeSymbol, onCurrencySideUpdate)
        }

        this.evt = new Event()
        this.evt.registerCallback(callback)
        
        depthSubscriber(assetSideExchangeSymbol, onAssetSideUpdate)
        depthSubscriber(currencySideExchangeSymbol, onCurrencySideUpdate)
    }

    raisePriceUpdateEvt(){
        let [assetBestBidLevel , assetBestAskLevel] = this.assetBestBidAsk
        let [currencyBestBidLevel , currencyBestAskLevel] = this.currencyBestBidAsk
        let [assetBestBP, assetBestBQ] = assetBestBidLevel
        let [assetBestAP, assetBestAQ] = assetBestAskLevel
        let [currencyBestBP, currencyBestBQ] = currencyBestBidLevel
        let [currencyBestAP, currencyBestAQ] = currencyBestAskLevel

        const dynamicInfo = this.staticInfo
        dynamicInfo.bids = [[assetBestAP/currencyBestBP, assetBestAQ]]
        dynamicInfo.asks = [[assetBestBP/currencyBestAP, currencyBestAQ]]
        this.evt.raise(dynamicInfo)
    }

    addSubscriber(callback){
        this.evt.registerCallback(callback)
    }

    //Caution! after calling this function please check if it's empty and if it is, then
    //the reference of this object from the client code
    removeSubscriber(callback){
        this.evt.unregisterCallback(callback)
        if (this.evt.empty()){
            this.unsubscribeDepths()
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
            //The cosnstructor start the external subscription sort RAII 
            const exchange_side_asset_symbol = exchangeSymbolNameGenerator(asset, bridge, exchange)
            const exchange_side_currency_symbol = exchangeSymbolNameGenerator(currency, bridge, exchange)
            virtualSubscriberUnit = new VirtualSubscriberUnit((symbol, callback)=>this.depthSubscriber(symbol, exchange, callback),
                                                              (symbol, callback)=>this.depthUnsubscriber(symbol, exchange, callback),
                                                              {asset : asset,
                                                               currency : currency,
                                                               bridge : bridge,
                                                               exchange : exchange,
                                                               key : JSON.stringify([asset, currency, bridge, exchange]),
                                                               exchange_side_asset_symbol : exchange_side_asset_symbol,
                                                               exchange_side_currency_symbol : exchange_side_currency_symbol},
                                                               this.logger,
                                                               exchange_side_asset_symbol,
                                                               exchange_side_currency_symbol,
                                                               callback)

            this.subscriptionBook.set(key, virtualSubscriberUnit)
            
        }else{
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