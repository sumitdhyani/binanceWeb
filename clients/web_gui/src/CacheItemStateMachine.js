const JSFSM = require('./root/AsyncFSM')
const FSM = JSFSM.FSM
const State = JSFSM.State

class Init extends State{
    constructor(cache,
                key,
                subscriptionFunctions,
                timeoutInterval,
                sm,
                params,
                clientCallback)
    {
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.sm = sm
        this.params = params
        this.clientCallback = clientCallback
    }

    onEntry(){
        this.subscriptionFunctions.subscribe(...this.params, this.callback)
    }

    on_user_unsubscribe(clientCallback){
        if(this.clientCallback == clientCallback){
            this.subscriptionFunctions.unsubscribe(...this.params, clientCallback)
            this.cache.delete(this.key)
        }else{
            throw {message : "Unrecognized callback!"}
        }
    }

    on_auto_unsubscribe(clientCallback){
        if(this.clientCallback == clientCallback){
            return new PendingUnsubscription(this.cache,
                                             this.key,
                                             this.subscriptionFunctions,
                                             this.timeoutInterval,
                                             this.sm,
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
                sm,
                params,
                clientCallback){
        super()
        this.cache = cache
        this.key = key
        this.subscriptionFunctions = subscriptionFunctions
        this.timeoutInterval = timeoutInterval
        this.sm = sm
        this.params = params
        this.clientCallback = clientCallback
        this.timerId = 0
        this.nullCallback = update=>{}
    }

    onEntry(){
        this.subscriptionFunctions.subscribe(...this.params, this.nullCallback)
        this.subscriptionFunctions.unsubscribe(...this.params, this.clientCallback)
        this.timerId = setTimeout(()=>{
            this.subscriptionFunctions.unsubscribe(...this.params, this.nullCallback)
            this.timerId = 0
        }, this.timeoutInterval)
    }

    on_subscribe(callback){
        this.subscriptionFunctions.subscribe(...this.params, callback)
        if(0 !== this.timerId){
            clearTimeout(this.timerId)
            this.subscriptionFunctions.unsubscribe(...this.params, this.nullCallback)
        }
        return Init(this.cache,
                    this.key,
                    this.subscriptionFunctions,
                    this.timeoutInterval,
                    this.sm,
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
        super(()=> new Init(cache,
                            key,
                            subscriptionFunctions,
                            timeoutInterval,
                            this,
                            params,
                            clientCallback))
    }
}

export default CacheItemFsm