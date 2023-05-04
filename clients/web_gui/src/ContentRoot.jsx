import './App.css'
import PricesPage from './PricesPage'
import IntroPage from './IntroPage'
import {HorizontalTabs} from './CommonRenderingFunctions'
import { useEffect, useState } from 'react'
import constants from './Constants'

function Visual(props){
        const [updateCount, setUpdateCount] = useState(0)

        useEffect(()=>{
            const context = props.context
            
            context.prices_tab = [PricesPage, {subscription_functions : context.subscription_functions,
                                               virtual_subscription_functions : context.virtual_subscription_functions,
                                               symbol_dict : context.symbol_dict}]
                                               
            context.intro_tab = [IntroPage, {}]
            context.curr_tab = context.prices_tab
            console.log(`Main page on useEffect`)
            setUpdateCount(prev => prev + 1)
            return ()=> console.log(`Main page leaving useEffect`)
        },
        [])
        
        function onTabSelected(tab){
            if(tab != props.context.curr_tab){
                props.context.curr_tab = tab
                setUpdateCount(prev => prev + 1)
            }
        }

        console.log(`Rendering main page`)
        if(undefined !== props.context.curr_tab){
            const [Component, context] = props.context.curr_tab
            return(<div>
                      <div className="All-generic_components">
                          <h3><u><b>The Quant Hulk{updateCount.update_count}</b></u></h3>
                          <img src="Hulk.webp"/>
                      </div>
                      <HorizontalTabs tabs={[{title: "Intro", widget_id : constants.widget_ids.button, onClick : ()=> onTabSelected(props.context.intro_tab)},
                                             {title: "Market Prices", widget_id : constants.widget_ids.button, onClick : ()=> onTabSelected(props.context.prices_tab)}]}/>
 
                      <Component context={context}/>
                  </div>)
        }else{
            return (<div></div>)
        }
}

export default Visual
