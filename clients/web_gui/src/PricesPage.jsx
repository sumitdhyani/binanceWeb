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
    const [updateCount, setUpdateCount] = useState(0)

    useEffect(()=>{
        console.log(`PricesPage render`)
        return ()=> console.log(`PricesPage un-render`)
    },
    [])

    const context = props.context
    return(<div>
                <HorizontalTabs tabs={[{title: "Vanilla Prices"}, {title: "Cross Prices"}, {title: "Baskets"}]}/>
                <VanillaPricesTab context={context.vanilla_prices}/>
           </div>)
}

export default PricesPage
