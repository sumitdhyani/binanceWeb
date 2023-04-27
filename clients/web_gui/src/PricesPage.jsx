import './App.css'
import { useState, useEffect } from 'react'
import { HorizontalTabs, VerticalTabs } from './CommonRenderingFunctions'

function VanillaPricesTab(props){
    const [updateCount, setUpdateCount] = useState(0)
    useEffect(()=>{
        console.log(`VanillaPricesTab render`)
        return ()=> console.log(`VanillaPricesTab un-render`)
    },
    [])

    const context = props.context 
    const cache = context.cache
    return <VerticalTabs tabs={cache.map(item=> {return {title1 : "unsubscribe", title2 : "expand", content : item}})}/>
}

function CrossPricesTab(props){
    const [updateCount, setUpdateCount] = useState(0)
    useEffect(()=>{
        console.log(`CrossPricesTab render`)
        return ()=> console.log(`CrossPricesTab un-render`)
    },
    [])

    const context = props.context 
    const cache = context.cache
    return <VerticalTabs tabs={cache.map(item=> {return {title1 : "unsubscribe", title2 : "expand", content : item}})}/>
}


function PricesPage(props){
    const [caches, setUpdateCount] = useState({vanilla_cache : new Set(), cross_cache : new Set(), basket_cache : new Set()})

    useEffect(()=>{
        console.log(`PricesPage render`)
        return ()=> console.log(`PricesPage un-render`)
    },
    [])

    const context = props.context
    if(undefined === context.vanilla_prices){
        const subscriptionFunc = (symbol, exchange, callback)=>{
            context.subscription_functions.subscribe(symbol, exchange, callback)
            caches.vanilla_cache.add(JSON.stringify([symbol, exchange]))
        }

        const unsubscriptionFunc = (symbol, exchange, callback)=>{
            context.subscription_functions.unsubscribe(symbol, exchange, callback)
            caches.vanilla_cache.delete(JSON.stringify([symbol, exchange]))
        }

        context.vanilla_prices = {subscription_functions : {subscribe : subscriptionFunc, unsubscribe : unsubscriptionFunc},
                                  cache : [...caches.vanilla_cache].map(item=> JSON.parse(item))
                                 }
    }
    
    return(<div>
                <HorizontalTabs tabs={[{title: "Vanilla Prices"}, {title: "Cross Prices"}, {title: "Baskets"}]}/>
                <VanillaPricesTab context={context.vanilla_prices}/>
           </div>)
}

export default PricesPage
