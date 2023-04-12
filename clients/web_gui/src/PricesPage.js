logger = {
    debug : str => console.log(str),
    info : str => console.log(str),
    error : str => console.log(str),
    warn : str => console.log(str)
}

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
    constructor(subUnsubFuncs){
        this.subUnsubFuncs = subUnsubFuncs
        this.marketsTab = new MarketsTab(this.subUnsubFuncs)
        this.curr_tab = this.marketsTab

        const dummyTabInteface = {
            content : ()=> <h1>UNDEF!</h1>
        }
        
        this.tabsProvider = {markets : {content : () => this.marketsTab.content()},
                             virtuals : dummyTabInteface,
                             baskets : dummyTabInteface,
                             alerts : dummyTabInteface,
                             dummy : dummyTabInteface}
    }

    onEntry(){
        this.curr_tab.onEntry()
    }

    onLeaving(){
        this.curr_tab.onLeaving()
    }

    ontabSwitch(newTabName){
        const newTab = this.tabs[newTabName]
        if(undefined == newTab){
            logger.error(`Undefined tab name: ${tabName}`)
            return this.tabsProvider.dummy
        }

        this.curr_tab.onLeaving()
        this.curr_tab = newTab
        return this.curr_tab
    }

    content(){
        return this.curr_tab.content()
    }
}

module.exports.PricesPageContent = PricesPage
module.exports.InitPricesPage = subUnsubFuncs => PricesPage.sunUnsubFuncs = subUnsubFuncs

