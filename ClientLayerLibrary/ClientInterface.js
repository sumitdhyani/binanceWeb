const { ClientLayerFSM } = require("./StateMachine/ClientLayerFSM")
const Validator = require("./ValidatorLayer/Validator")
const NetworkServices = require("./NetworkLayer/RequestForwarder")

let fsm = null

function start(auth_params, data_callback, logger){

    fsm = new ClientLayerFSM({auth_params : auth_params,
                              authentication_method : (auth_params)=>{ setTimeout(() => {
                                fsm.handleEvent("auth_response", {success: true, conn_params : "http://127.0.0.1:80"})
                              }, 1);},
                              feed_server_conn_method : NetworkServices.connect,
                              connection_layer_termination_method : NetworkServices.disconnect,
                              intent_handler : (intent)=>{
                                Validator.validateRequest(intent)
                                NetworkServices.forward(intent)
                              },
                              subscription_dictionary : new Set(),
                              data_callback: data_callback,
                              logger : logger})
    fsm.start()
}


function executeIntent(intent){
    fsm.handleEvent("client_intent", intent)
}

module.exports.launch = start
module.exports.subUnsub = executeIntent