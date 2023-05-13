import './App.css'
import { useState, useEffect, useRef } from 'react'
import { HorizontalTabs, VerticalTabsForVanillaPrices, SearchBoxRow, EditableDropdownRow} from './CommonRenderingFunctions'
import constants from './Constants'
import CacheItemFsm from './CacheItemStateMachine'
function VanillaPricesTab(props){
    const context = props.context
    const subscription_functions = context.subscription_functions

    const symbol_dict = context.symbol_dict
    const [cache, setCache] = useState(()=>{
        console.log("Resetting")
        const existingCache = context.cache
        const initCache = new Map()
        if (undefined !== existingCache) {
            existingCache.forEach(key=> initCache.set(key, null))
        }
        return initCache
    })

    const priceCallback = useRef((update)=>{
        //console.log(`Update received: ${JSON.stringify(update.key)}`)
        setCache(prev => {
            //console.log(`Old Cache: ${JSON.stringify([...prev.keys()])}`)
            const ret = new Map([...prev, [update.key, update]])
            //console.log(`Now Cache: ${JSON.stringify([...ret.keys()])}`)
            return ret
        })
    })
   
    const tabsForDropDownRow = useRef([ {  title : "search",
                                    options : [...symbol_dict.keys()],
                                    onOptionSelected : (evt, key) => {
                                        setCache(prev=>{
                                            console.log(`Old Cache: ${JSON.stringify([...prev.keys()])}`)
                                            if(key && undefined === prev.get(key)){
                                                console.log(`Select Changed Handler, value: ${key}`)
                                                subscription_functions.subscribe(...JSON.parse(key), priceCallback.current)
                                                console.log(`Old Cache: ${JSON.stringify([...prev.keys()])}`)
                                                return new Map([...prev, [key, null]])
                                            } else {
                                                return prev
                                            }
                                        })
                                    }
                                  }
                                ])
    useEffect(()=>{
        console.log("Mounting")
        setCache(prev=>{
            const arr = [...prev.keys()]
            arr.forEach(key=>{
                subscription_functions.subscribe(...JSON.parse(key), priceCallback.current)
            })
            return prev
        })

        return ()=>{
            console.log("UnMounting")
            setCache(prev=>{
                const arr = [...prev.keys()]
                arr.forEach(key=>{
                    subscription_functions.unsubscribe(...JSON.parse(key), priceCallback.current)
                })
                context.cache = arr
                return prev
            })
        }
    },[])

    return (
            [<EditableDropdownRow   tabs={tabsForDropDownRow.current}
                                    nameConverter = { key=> JSON.parse(key)[0] }
                                    key={0}
             />,
             <VerticalTabsForVanillaPrices tabs={[...cache.keys()].map(key=> {
                                                                    return {symbol : symbol_dict.get(key).description,
                                                                            update : cache.get(key),
                                                                            user_unsubscribe_action : ()=>{
                                                                                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback.current)
                                                                                setCache(existing=>{
                                                                                    existing.delete(key)
                                                                                    return new Map(existing)
                                                                                })
                                                                            },
                                                                        }
                                                                })} key={1}/>
            ]
    )
}

function CrossPricesTab(props){
    return <h1>CrossPricesTab</h1>
}

function BasketPricesTab(props){
    return <h1>BasketPricesTab</h1>
}

function PricesPage(props){
    const [updateCount, setUpdateCount] = useState(0)

    const context = props.context
    function onTabSelected(tab){//Tab is an array: [Component For Tab, Its context]
        if(tab[0] != context.curr_tab[0]){
            context.curr_tab = tab
            setUpdateCount(prev =>prev + 1)
        }
    }
    
    if(undefined === context.vanilla_prices ||
       undefined === context.cross_prices ||
       undefined === context.basket_prices)
    {
        context.vanilla_prices = 
        context.basket_prices = {subscription_functions : context.subscription_functions,
                                 symbol_dict : context.symbol_dict}

        context.cross_prices = {subscription_functions : context.virtual_subscription_functions,
                                symbol_dict : context.symbol_dict}

        context.curr_tab = [VanillaPricesTab, context.vanilla_prices]
    }
    
    const [CurrComponent, currContext] = context.curr_tab
    return(<div>
                <HorizontalTabs tabs={[{title: "Vanilla Prices", onClick : ()=>{onTabSelected([VanillaPricesTab, context.vanilla_prices])}, widget_id : constants.widget_ids.button},
                                       {title: "Cross Prices", onClick : ()=>{onTabSelected([CrossPricesTab, context.cross_prices])}, widget_id : constants.widget_ids.button},
                                       {title: "Baskets", onClick : ()=>{onTabSelected([BasketPricesTab, context.basket_prices])}, widget_id : constants.widget_ids.button}]}/>
                <CurrComponent context = {currContext}/>
           </div>)
}


export default PricesPage
