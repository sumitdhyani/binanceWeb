FSM = require('../AsyncFSM')

const State = FSM.State
const ConnectingToFeedServer = require("./ConnectingToFeedServer").ConnectingToFeedServer
const Exiting = require("./Exiting").Exiting

class Authenticating extends State{
    constructor(params){
        super()
        this.construction_params = params 
        this.auth_params = params.auth_params
        this.authentication_method = params.authentication_method
        this.feed_server_conn_method = params.feed_server_conn_method
        this.connection_layer_termination_method = params.connection_layer_termination_method
        this.intent_handler = params.intent_handler
        this.data_callback= params.data_callback
        this.subscription_dictionary = params.subscription_dictionary
        this.logger = params.logger
    }

    onEntry(){
        this.authentication_method(this.conn_params)
    }

    on_auth_response(response){
        if(response.success){
            return ConnectingToFeedServer({feed_server_conn_method: this.feed_server_conn_method, 
                                           conn_params: response.conn_params,
                                           intent_handler : this.intent_handler,
                                           data_callback: this.data_callback,
                                           subscription_dictionary : this.subscription_dictionary,
                                           authentication_params : this.construction_params,
                                           logger : this.logger})
        }
        else{
            return Exiting({reason : response.reason,
                            connection_layer_termination_method : this.connection_layer_termination_method,
                            logger : this.logger})
        }
    }
}

class ConnectingToFeedServer extends State{
    constructor(params){
        super()
        this.feed_server_conn_method = params.feed_server_conn_method
        this.conn_params = params.conn_params
        this.intent_handler = params.intent_handler
        this.data_callback = params.data_callback
        this.authentication_params = params.authentication_params
        this.subscription_dictionary = params.subscription_dictionary
        this.logger = params.logger
    }

    on_launch(){
        try{
            this.feed_server_conn_method(this.conn_params, this.data_callback, this.logger)
            return SyncingSubscriptions({intent_handler : this.intent_handler,
                                            data_callback: this.data_callback,
                                            subscription_dictionary : this.subscription_dictionary,
                                            logger: this.logger})
        }
        catch(err){
            this.logger(err.message)
            return cirucularSafe(Authenticating, ()=>{return require('./Authenticating').Authenticating})(this.authentication_params)
        }

    }
}

class Exiting extends State{
    constructor(params){
        super(true)
        this.reason = params.reason
        this.connection_layer_termination_method = params.connection_layer_termination_method
        this.logger = params.logger
    }

    onEntry(){
        this.logger(`Exiting the library layer, reason: ${this.reason}`)
        this.connection_layer_termination_method()
    }
}

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

module.exports.Authenticating = Authenticating
