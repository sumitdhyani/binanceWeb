import './App.css'
import PricesPage from './PricesPage'
import { horizontal_tabs } from './CommonRenderingFunctions'

class RootComponent{
    constructor(pages){
        this.pages = pages
        this.tab_ids = {prices: 1, intro : 2}
        //Each "_page" property will be an object haing the functions
        //with following property names:
        //content() -- Returns the gui component representing the data it holds
        //on_entry()
        //before_exit()
        this.current_page = this.pages.prices_page
    }

    onTabSelected(name){
        console.log(`Tab selected: ${name}`)
    }

    visual(){
        const Visual = this.current_page.visual
        return( <div>
                    <generic className="All-generic_components">
                        <h3><u><b>The Quant Hulk</b></u></h3>
                        <img src="Hulk.webp"/>
                    </generic>
                    {horizontal_tabs([{title: "Intro", onClick : ()=>{ this.onTabSelected(`Intro`) }},
                                      {title: "Market Prices", onClick : ()=>{ this.onTabSelected(`Prices`)}}]
                                    )
                    }
                    {this.current_page.visual()}
                </div>)
    }

    //on_page_change(new_page){
    //    this.current_page.notify_on_content_change(()=>{})
    //    this.current_page.before_exit()
    //    this.current_page = new_page
    //    this.current_page.on_entry()
    //    this.current_page.notify_on_content_change(()=>this.notification_method())
    //}
}

let rootComponent = null
export function Visual(){    
        return rootComponent.visual()
}

export function initRendering(){
        if(null === rootComponent){
        const pricesPage = new PricesPage(null, {vanilla_prices : {after_entry :()=>{},
                                                                before_exit : ()=>{},
                                                                visual : ()=>{ }}
                                                })
        rootComponent = new RootComponent({prices_page : pricesPage
                                          })
    }
}