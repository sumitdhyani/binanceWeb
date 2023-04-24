import './App.css'
import PricesPage from './PricesPage'
import IntroPage from './IntroPage'
import { horizontal_tabs } from './CommonRenderingFunctions'
import { useState } from 'react'

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
        const [state, setState] = useState(()=>{
            const initState = {pages : {prices_page : PricesPage, intro_page : IntroPage},
                               count : 0}    
            initState.current_page = initState.pages.intro_page
            return initState
        })
        
        function onTabSelected(tab){ 
            
            setState(prev => {
                if(tab != prev.current_page){
                    return {...prev, count : prev.count + 1, current_page : tab  }
                }
                return prev
            })
        }

        console.log(`Rendering main page`)

        return(<div>
                  <generic className="All-generic_components">
                      <h3><u><b>The Quant Hulk: {state.count}</b></u></h3>
                      <img src="Hulk.webp"/>
                  </generic>
                  {horizontal_tabs([{title: "Intro", onClick : ()=> onTabSelected(state.pages.intro_page)   },
                                    {title: "Market Prices", onClick : ()=> onTabSelected(state.pages.prices_page)}]
                                  )
                  }
                  <state.current_page />
              </div>)
}

export default Visual
