class MarketsTab
{
    constructor(sunUnsubFuncs){
        this.sunUnsubFuncs = sunUnsubFuncs
        this.subscriptionBook = new Set()
        this.updateBook = new Map()
        this.pendingUnsubscription = false
        this.unsubscriptionTimerId = 0
    }

    onUpdate(update){
        let update = JSON.parse(data)
        updateBook.set(JSON.stringify([update.symbol, update.exchange]), update)
    }

    onEntry(){
        if(0 != this.unsubscriptionTimerId){
            clearTimeout(this.unsubscriptionTimerId)
            this.unsubscriptionTimerId = 0
        }
    }

    onLeaving(){
        this.unsubscriptionTimerId =  setTimeout(()=>{
            [...this.subscriptionBook].forEach((item)=>{
                [symbol, exchange] = JSON.parse(item)
                this.sunUnsubFuncs.unsubscribe(symbol, exchange, this.onUpdate)
            })
            this.unsubscriptionTimerId = 0
        },
        30000)
    }

    subscribe(symbol, exchange){
        this.sunUnsubFuncs.subscribe(symbol, exchange, this.onUpdate)
        this.subscriptionBook.add()
    }

    usubscribe(symbol, exchange){
        this.sunUnsubFuncs.unsubscribe(symbol, exchange, this.onUpdate)
    }

    content(){
        return ([...this.updateBook.values()].map( data=> 
                                                    <h1>Id: {JSON.stringify([data.symbol, data.exchange])}, Bids: {depthComponent(data.bids)}, Asks: {depthComponent(data.asks)}</h1>
                                                 )
               )
    }
}

class PricesPage{
    constructor(subUnsubFuncs, tabs){
        this.subUnsubFuncs = subUnsubFuncs
        this.notification_method = null
        this.tabs = tabs
        this.curr_tab = this.vanilla_prices
    }

    on_entry(){
        this.curr_tab.onEntry()
    }

    before_exit(){
        this.curr_tab.onLeaving()
    }

    content(){
        <d></>
    }

    content(){
        return this.curr_tab.content()
    }
}

module.exports.PricesPageContent = PricesPage
