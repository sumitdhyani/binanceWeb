import './App.css'
import { useState, useEffect } from 'react'
import { HorizontalTabs, VerticalTabsForVanillaPrices, SearchBoxRow, EditableDropdownRow} from './CommonRenderingFunctions'
import constants from './Constants'

function VanillaPricesTab(props){
    const context = props.context
    if(undefined === context.cache){
        context.cache = new Set()
    }
    const cache = context.cache

    const symbol_dict = context.symbol_dict
    const [updateCount, setUpdateCount] = useState(0)
   
    return (
            [<EditableDropdownRow   tabs={[ {   title : "search",
                                                options : [...symbol_dict.keys()],
                                                onOptionSelected : (evt, value) => {
                                                   if(value && !cache.has(value)){
                                                        console.log(`Select Changed Handler, value: ${value}`)
                                                        cache.add(value)
                                                        setUpdateCount(prev=>prev + 1)
                                                   }
                                                }
                                            }
                                          ]
                                         }
                                    nameConverter = { key=> JSON.parse(key)[0] }
             />,
             <VerticalTabsForVanillaPrices tabs={[...cache].map(item=> {
                                                                    return {title1 : "unsubscribe", 
                                                                            title2 : "expand",
                                                                            content : symbol_dict.get(item).description,
                                                                            renderingAction : {}}
                                                                })}/>
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
