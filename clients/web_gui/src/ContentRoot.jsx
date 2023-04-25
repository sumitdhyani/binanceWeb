import './App.css'
import PricesPage from './PricesPage'
import IntroPage from './IntroPage'
import { horizontal_tabs } from './CommonRenderingFunctions'
import { useEffect, useState } from 'react'

//class RootComponent extends React.Component{
//    constructor(props){
//        super(props)
//        this.pages = props.pages
//        this.state = {
//            count : 0,
//        }
//        //Each "_page" property will be an object haing the functions
//        //with following property names:
//        //content() -- Returns the gui component representing the data it holds
//        this.current_page = this.pages.prices_page
//    }
//
//    onTabSelected(name){
//        console.log(`Tab selected: ${name}`)
//        this.setState({ count: this.state.count + 1 })
//    }
//
//    render(){
//        return (<>{this.visual()}</>)
//    }
//
//    visual(){
//        console.log(`re-render`)
//        return( <div>
//                    <generic className="All-generic_components">
//                        <h3><u><b>The Quant Hulk: {this.state.count}</b></u></h3>
//                        <img src="Hulk.webp"/>
//                    </generic>
//                    {horizontal_tabs([{title: "Intro", onClick : ()=> this.onTabSelected(state.intro_page)   },
//                                      {title: "Market Prices", onClick : ()=> this.onTabSelected(state.prices_page)}]
//                                    )
//                    }
//                    {this.current_page.visual()}
//                </div>)
//    }
//
    //on_page_change(new_page){
    //    this.current_page.notify_on_content_change(()=>{})
    //    this.current_page = new_page
    //    this.current_page.on_entry()
    //    this.current_page.notify_on_content_change(()=>this.notification_method())
    //}
//}

function Visual(props){
        const [updateCount, setUpdateCount] = useState(0)

        useEffect(()=>{
            const context = props.context
            
            context.prices_tab = [PricesPage, {vanilla_prices : {subscription_functions : context.subscription_functions, symbol_dict : context.symbol_dict, cache : ["BTCUSDT", "ETHUSDT"]},
                                               virtual_prices : {subscription_functions : context.virtual_subscription_functions, symbol_dict : context.symbol_dict, cache : []},
                                               baskets : {subscription_functions : context.virtual_subscription_functions, symbol_dict : context.symbol_dict, cache : []}}]
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
        if(undefined != props.context.curr_tab){
            const [Component, context] = props.context.curr_tab
            return(<div>
                      <generic className="All-generic_components">
                          <h3><u><b>The Quant Hulk: {updateCount.update_count}</b></u></h3>
                          <img src="Hulk.webp"/>
                      </generic>
                      {horizontal_tabs([{title: "Intro", onClick : ()=> onTabSelected(props.context.intro_tab)},
                                        {title: "Market Prices", onClick : ()=> onTabSelected(props.context.prices_tab)}])
                      }
                      <Component context={context}/>
                  </div>)
        }else{
            return (<div></div>)
        }
}

export default Visual
