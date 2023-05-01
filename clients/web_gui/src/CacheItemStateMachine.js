const JSFSM = require('./root/AsyncFSM')
const FSM = JSFSM.FSM
const State = JSFSM.State
const SpecialTransition = JSFSM.SpecialTransition

class Init extends State{
    constructor(cache, key, subscriptionFunctions, timeoutInterval, sm, clientCallback){
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.sm = sm
        this.clientCallback = clientCallback
    }

    on_unsubscribe(clientCallback){
        if(this.clientCallback == clientCallback){
            return new PendingUnsubscription(this.cache,
                                             this.key,
                                             this.subscriptionFunctions,
                                             this.timeoutInterval,
                                             this.sm,
                                             clientCallback)
        }else{
            throw {message : "Unrecognized callback!"}
        }
    }
}

class PendingUnsubscription extends State{
    constructor(cache,
                key,
                subscriptionFunctions,
                timeoutInterval,
                sm,
                clientCallback){
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.sm = sm
        this.clientCallback = clientCallback
        this.timerId = 0
        this.nullCallback = 
    }

    onEntry(){
        const nullCallback = update=>{}
        const [symbol, exchange] = JSON.parse(this.key)
        this.subscriptionFunctions.subscribe(symbol, exchange, nullCallback)
        this.subscriptionFunctions.unsubscribe(symbol, exchange, this.clientCallback)
        this.timerId = setTimeout(()=>{
            this.subscriptionFunctions.unsubscribe(symbol, exchange, nullCallback)
            setImmediate(()=>this.sm.handleEvent("unsubscribed"))
        }, this.timeoutInterval)
    }

    on_subscription(callback){
     c   
    }

    on_unsubscribed(){

    }
}

class ClientLayerFSM extends FSM{
    //ket is the JSON string for [symbol, exchange]
    constructor(cache, key, subscriptionFunctions, timeoutInterval){
        super(()=> new Init(cache, key, subscriptionFunctions, timeoutInterval))
    }
}

module.exports.ClientLayerFSM = ClientLayerFSM