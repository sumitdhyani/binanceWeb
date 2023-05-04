const JSFSM = require('./root/AsyncFSM')
const FSM = JSFSM.FSM
const State = JSFSM.State

class Operational extends State{
    constructor(cache,
                key,
                subscriptionFunctions,
                timeoutInterval,
                params,
                clientCallback)
    {
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.params = params
        this.clientCallback = clientCallback
        this.updateFunc = this.on_update.bind(this)
    }

    on_update(update){
        this.clientCallback(update)
    }

    onEntry(){
        this.subscriptionFunctions.subscribe(...this.params, this.updateFunc)
    }

    beforeExit(){
        setTimeout(()=>this.subscriptionFunctions.unsubscribe(...this.params, this.updateFunc))
    }

    on_user_unsubscribe(clientCallback){
        if(true){
            this.subscriptionFunctions.unsubscribe(...this.params, this.updateFunc)
        }else{
            throw {message : "Unrecognized callback!"}
        }
    }

    on_auto_unsubscribe(clientCallback){
        if(this.clientCallback === clientCallback){
            return new PendingUnsubscription(this.cache,
                                             this.key,
                                             this.subscriptionFunctions,
                                             this.timeoutInterval,
                                             this.params,
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
                params,
                clientCallback){
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.params = params
        this.clientCallback = clientCallback
        this.timerId = 0
        this.nullCallback = this.on_update.bind(this)
    }

    on_update(update){
    }

    onEntry(){
        this.subscriptionFunctions.subscribe(...this.params, this.nullCallback)
        this.timerId = setTimeout(()=>{
            //console.log(`Timeout hit`)
            this.subscriptionFunctions.unsubscribe(...this.params, this.nullCallback)
            this.timerId = 0
        }, this.timeoutInterval)
    }

    on_auto_subscribe(callback){
        if(0 !== this.timerId){
            //console.log(`Clearing timeout`)
            clearTimeout(this.timerId)
            this.timerId = 0
            setTimeout(()=>this.subscriptionFunctions.unsubscribe(...this.params, this.nullCallback))      
        }
        return new Operational(this.cache,
                    this.key,
                    this.subscriptionFunctions,
                    this.timeoutInterval,
                    this.params,
                    callback)
    }
}

class CacheItemFsm extends FSM{
    constructor(cache,
                key,
                subscriptionFunctions,
                timeoutInterval,
                params,
                clientCallback)
    {
        super(()=> new Operational(cache,
                            key,
                            subscriptionFunctions,
                            timeoutInterval,
                            params,
                            clientCallback),
              {error : msg => console.log(msg),
               warn : msg => console.log(msg),
               info : msg => {},
               debug : msg => {}}
              )
    }
}

export default CacheItemFsm