FSM = require('../AsyncFSM')

const State = FSM.State
const Operational = require('./Operational').Operational

class SyncingSubscriptions extends State{
    constructor(params){
        super()
        this.intent_handler = params.intent_handler
        this.subscription_dictionary = params.subscription_dictionary
        this.data_callback = params.data_callback
        this.logger = params.logger
    }

    on_launch(){
        try{
            for (let params of this.subscription_dictionary){
                this.intent_handler(params)
            }

            return Operational({intent_handler : this.intent_handler,
                                    data_callback: this.data_callback,
                                    subscription_dictionary : this.subscription_dictionary,
                                    logger: this.logger})
        }
        catch(err){
            this.logger(`Error in syncing phase, deatils: ${err.message}`)
            return FSM.Specialtransition.nullTransition
        }

    }
}

module.exports.SyncingSubscriptions = function (params){ return new SyncingSubscriptions(params) }
