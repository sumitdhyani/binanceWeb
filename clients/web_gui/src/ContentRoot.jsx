import './App.css'
import PricesPage from './PricesPage'

class RootComponent{
    constructor(pages){
        this.pages = pages
        //Each "_page" property will be an object haing the functions
        //with following property names:
        //content() -- Returns the gui component representing the data it holds
        //on_entry()
        //before_exit()
        this.current_page = this.pages.prices_page
    }

    visual(){
        const Visual = this.current_page.visual
        return(<div>
                    <generic classname="All-generic_components">
                        <logo  className="App-logo">
                            <img src="Hulk.webp"/>
                            <span><u><b>The Quant Hulk</b></u></span>
                        </logo>
                        <div className=" All-generic_components Top-tabs">
                            <button>Market_Prices</button>
                            <button>Intro</button>
                        </div>
                    </generic>
                    <Visual />
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