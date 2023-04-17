import './logo.css'
class RootComponent{
    constructor(pages, notification_method){
        this.pages = pages
        this.init = init
        //Each "_page" property will be an object haing the functions
        //with following property names:
        //notify_on_content_change(callback) 
        //content()
        //on_entry
        //before_exit
        this.current_page = this.pages.intro_page
        this.notification_method = notification_method
    }

    content(){
        return(<div>
                    <head>
                        <link rel="stylesheet" href="app.css"/>
                    </head>
                    <logo>
                        <img src="Hulk.webp"/>
                        <br></br>
                        <span><u><b>The Quant Hulk</b></u></span>
                    </logo>
                    <specific_content>
                        <this.current_page.content />
                    </specific_content>
                </div>)
    }

    on_page_change(new_page){
        this.current_page.notify_on_content_change(()=>{})
        this.current_page.before_exit()
        this.current_page = new_page
        this.current_page.on_entry()
        this.current_page.notify_on_content_change(()=>this.notification_method())
    }
}