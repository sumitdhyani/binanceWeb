import './logo.css'
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
        return(<div>
                    <head>
                        <link rel="stylesheet" href="app.css"/>
                    </head>
                    <logo>
                        <img src="Hulk.webp"/>
                        <br></br>
                        <span><u><b>The Quant Hulk</b></u></span>
                    </logo>

                    <top_tabs>
                        <button>Market Prices</button>
                        <button>Intro</button>
                    </top_tabs>
                    <this.current_page.content />
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
export function visual(){
    if(null === rootComponent){
        rootComponent = new RootComponent({prices_page : {after_entry :()=>{},
                                                          before_exit : ()=>{},
                                                          visual : ()=>{ return <h1>Hello World!</h1>}}
                                          })
    }

    return rootComponent.visual()
}