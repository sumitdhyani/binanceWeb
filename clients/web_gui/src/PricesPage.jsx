import './App.css'
import { useState, useEffect } from 'react'
import { HorizontalTabs, VerticalTabs, SearchBoxRow, EditableDropdownRow} from './CommonRenderingFunctions'
import constants from './Constants'

function VanillaPricesTab(props){
    const context = props.context
    const cache = context.cache
    const symbol_dict = context.symbol_dict
    //console.log(`Set: ${JSON.stringify(cache)}, typeof cache: ${typeof cache}`)
    const [state, setState] = useState({cache : cache})
    useEffect(()=>{
        console.log(`VanillaPricesTab render`)
        return ()=> console.log(`VanillaPricesTab un-render`)
    },
    [])

    
    return (
            [<EditableDropdownRow tabs={[{title : "search",
                                         options : [...symbol_dict.keys()],
                                         onOptionSelected : (evt, value) => {
                                            const cache = state.cache
                                            console.log(`Select Changed Handler, value: ${value}`)
                                            if(!cache.has(value)){
                                                cache.add(value)
                                                setState({...state})
                                            }
                                         }
                                        }]}/>,
             <VerticalTabs tabs={[...cache].map(item=> {return {title1 : "unsubscribe", title2 : "expand", content : item}})}/>
            ]
    )
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
    const [caches, setCaches] = useState({vanilla_cache : new Set(["BTCUSDT"]), cross_cache : new Set(), basket_cache : new Set()})
    const context = props.context

    useEffect(()=>{
        console.log(`PricesPage render`)
        const subscriptionFunc = (symbol, exchange, callback)=>{
            context.subscription_functions.subscribe(symbol, exchange, callback)
            const symbolAndExchange = JSON.stringify([symbol, exchange]) 
            if(!caches.vanilla_cache.has(symbolAndExchange))
            {
                caches.vanilla_cache.add(symbolAndExchange)
                setCaches({...caches})
            }
        }

        const unsubscriptionFunc = (symbol, exchange, callback)=>{
            context.subscription_functions.unsubscribe(symbol, exchange, callback)
            caches.vanilla_cache.delete(JSON.stringify([symbol, exchange]))
        }

        context.vanilla_prices = {subscription_functions : {subscribe : subscriptionFunc, unsubscribe : unsubscriptionFunc},
                                  cache : caches.vanilla_cache,
                                  symbol_dict : context.symbol_dict
                                 }
        return ()=> console.log(`PricesPage un-render`)
    },[])

   
    console.log(`Prices page context: ${JSON.stringify(context)}`)
    if(undefined === context.vanilla_prices){
        return <></>
    }
    return(<div>
                <HorizontalTabs tabs={[{title: "Vanilla Prices", widget_id : constants.widget_ids.button},
                                       {title: "Cross Prices", widget_id : constants.widget_ids.button},
                                       {title: "Baskets", widget_id : constants.widget_ids.button}]}/>
                <VanillaPricesTab context = {context.vanilla_prices}/>
           </div>)
}

export default PricesPage
