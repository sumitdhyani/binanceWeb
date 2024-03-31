const CommonUtils = require('./root/IndependentCommonUtils/CommonUtils')
const appSpecificErrors = require('./root/IndependentCommonUtils/appSpecificErrors')
const [SpuriousUnsubscription, DuplicateSubscription] = [appSpecificErrors.SpuriousUnsubscription, appSpecificErrors.DuplicateSubscription]
const Event = CommonUtils.Event

class BasketSubscriptionHandler {
    constructor(depthSubscriber, depthUnsubscriber) {
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.assetPriceEvents = new Map()
    }

    subscribe(symbols, callback) {
        symbols.forEach(symbol => {
            if (!(this.assetPriceEvents.has(symbol))){
                const evt = new Event()
                this.assetPriceEvents.set(symbol, evt)
                this.depthSubscriber(symbol, update=> evt.raise(update) )
            }

            const evt = this.assetPriceEvents.get(symbol)
            evt.registerCallback(callback)
        })
    }
    
    unsubscribe(symbols, callback) {
        symbols.forEach(symbol => {
            if (!(this.assetPriceEvents.has(symbol))) {
                throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
            }

            const evt = this.assetPriceEvents.get(symbol)
            evt.unregisterCallback(callback)
            if (evt.empty()){
                this.assetPriceEvents.delete(symbol)
                this.depthUnsubscriber(symbol)
            }
        })
    }
}


class BasketSubscriptionUnit {
    constructor(assets) {
        this.assets = assets
        this.updates = new Map()
        this.allPricesReceived = false
        this.evt = new Event()
    }

    checkIfAllUpdatesRecd(update) {
        if (this.allPricesReceived) {
            return
        }
        
        this.updates.set(update.symbol, (update.bids[0][0] + update.asks[0][0]) / 2)
        if (this.updates.size === this.assets.length) {
            this.allPricesReceived = true
        }
    }

    onUpdate(update) {
        if (this.allPricesReceived || this.checkIfAllUpdatesRecd(update)) {
            this.updates.set(update.symbol, (update.bids[0][0] + update.asks[0][0]) / 2)
            const updateArr = []
            this.updates.forEach((value, key) => {
                updateArr.push(value)
            })
            this.evt.raise(updateArr)
        }
    }

    subscribe(callback) {
        this.evt.registerCallback(callback)
    }
}

function applyCoefficients(coefficients, updates) {
    return updates.reduce((acc, update, index) => {
        return acc + update * coefficients[index]
    }, 0)
}

function applyConverters(converters, updates) {
    let res = []
    for( let i = 0; i < converters.length; i++){
        res.push(converters[i](updates[i]))
    }
    return res
}

class CurrencyAndCoefficientMultiplexedBasketSubscriptionHandler {
    constructor(depthSubscriber, depthUnsubscriber, logger) {
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        //key currency, value BasketSubscriptionHandler
        this.currencyToBasketSubscriptions = new Map()
        //key reqId, value unsubscriptionAction
        this.unsubscriptionActions = new Map()
    }

    subscribe(reqId, symbols, coefficients, currency, priceConverters, exchange, callback) {
        if(!( symbols.length === coefficients.length && coefficients.length === priceConverters.length)){
            throw new Error("The length of symbols, coefficients and priceConverters should be equal")
        }

        const key = JSON.stringify([currency, exchange])
        if (!(this.currencyToBasketSubscriptions.has(key))) {
            const basketSubscriptionHandler = new BasketSubscriptionHandler(
                                                (symbol, callback)=>this.depthSubscriber(symbol, exchange, callback), 
                                                (symbol, callback)=>this.depthUnsubscriber(symbol, exchange, callback)
                                            )
            this.currencyToBasketSubscriptions.set(key, basketSubscriptionHandler)
        }

        const basketSubscriptionHandler = this.currencyToBasketSubscriptions.get(key)
        const basketSubscriptionUnit = new BasketSubscriptionUnit(symbols)
        const callbackForSubscriptionUnit = (updates) => {
            const updateObj = {
                exchange : exchange,
                basket: symbols,
                currency: currency,
                coefficients: coefficients,
                net_value : applyCoefficients(coefficients, applyConverters(priceConverters, updates))
            }
            callback(updateObj)
        }
        const callbackForBasketSubscriptionHandler = (updates) => { basketSubscriptionUnit.onUpdate(updates) }
        basketSubscriptionUnit.subscribe(callbackForSubscriptionUnit)
        basketSubscriptionHandler.subscribe(symbols, callbackForBasketSubscriptionHandler)

        this.unsubscriptionActions.set(reqId, ()=>{
            basketSubscriptionUnit.unsubscribe(callbackForSubscriptionUnit)
            basketSubscriptionHandler.unsubscribe(symbols, callbackForBasketSubscriptionHandler)
        })  
    }

    unsubscribe(reqId) {
        if (this.unsubscriptionActions.has(reqId)) {
            this.unsubscriptionActions.get(reqId)()
            this.unsubscriptionActions.delete(reqId)
        } else {
            throw new SpuriousUnsubscription(`The reqId ${reqId} is not currently subscribed`)
        }
    }
}

module.exports.BasketSubscriptionHandler = CurrencyAndCoefficientMultiplexedBasketSubscriptionHandler