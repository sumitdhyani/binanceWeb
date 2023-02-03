FSM = require('../AsyncFSM')
const State = FSM.State

class Operational extends State{
    constructor(params){
        super()
        this.intent_handler = params.intent_handler
        this.subscription_dictionary = params.subscription_dictionary
        this.logger = params.logger
    }

    on_client_intent(intent){
        this.intent_handler(intent)
    }

    on_price_data(data){
        this.data_callback(data)
    }
}

module.exports.Operational = function (params){ return new Operational(params) }