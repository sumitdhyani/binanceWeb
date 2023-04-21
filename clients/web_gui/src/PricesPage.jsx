import './App.css'
import { horizontal_tabs } from './CommonRenderingFunctions'
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
    }

    after_entry(){
        if(0 != this.unsubscriptionTimerId){
            clearTimeout(this.unsubscriptionTimerId)
            this.unsubscriptionTimerId = 0
        }
    }

    before_exit(){
        this.unsubscriptionTimerId =  setTimeout(()=>{
            [...this.subscriptionBook].forEach((item)=>{
                let [symbol, exchange] = JSON.parse(item)
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

    visual(){}
}

class PricesPage{
    constructor(subUnsubFuncs, tabs){
        this.subUnsubFuncs = subUnsubFuncs
        this.tabs = tabs
        this.curr_tab = this.vanilla_prices
    }

    on_entry(){
        this.curr_tab.onEntry()
    }

    before_exit(){
        this.curr_tab.onLeaving()
    }

    visual(){
        return(<>{horizontal_tabs([{title: "Vanilla Prices"},
                                   {title: "Cross Prices"},
                                   {title: "Baskets"}])
                 }
               </>)
    }
}

export default PricesPage
