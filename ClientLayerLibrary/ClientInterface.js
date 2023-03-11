const https = require('http')
const { ClientLayerFSM } = require("./StateMachine/ClientLayerFSM")
const Validator = require("./ValidatorLayer/Validator")
const NetworkServices = require("./NetworkLayer/RequestForwarder")

let fsm = null

function start(auth_params, data_callback, logger){

    fsm = new ClientLayerFSM({auth_params : auth_params,
                              authentication_method : (auth_params)=>{ 
                                                                      let retryInterval = 1
                                                                      func = ()=>{
                                                                        const url = auth_params.auth_server + "/auth/" + JSON.stringify(auth_params.credentials)
                                                                        https.get(url, res => {
                                                                          let data = ''
                                                                          res.on('data', chunk => {
                                                                            data += chunk
                                                                          });
                                                                          res.on('end', () => {
                                                                            data = JSON.parse(data)
                                                                            logger.debug(data);
                                                                            fsm.handleEvent("auth_response", {success: true, conn_params : "http://" + data.feed_server})
                                                                        })
                                                                        }).on('error', err => {
                                                                          logger.warn(`Error while authenticating details: ${err.message}, retrying in ${retryInterval} seconds`)
                                                                          setTimeout(()=>func(), retryInterval)
                                                                        })
                                                                      }
                                                                      
                                                                      func()
                                                                    },
                              feed_server_conn_method : NetworkServices.connect,
                              connection_layer_termination_method : NetworkServices.disconnect,
                              intent_handler : (intent)=>{
                                Validator.validateRequest(intent)
                                NetworkServices.forward(intent)
                              },
                              subscription_dictionary : new Set(),
                              data_callback: data_callback,
                              logger : logger})
    NetworkServices.setDisconnectionHandler(reason=>{
      fsm.handleEvent("disconnect", reason)
    })
    fsm.start()
}


function executeIntent(intent){
    fsm.handleEvent("client_intent", intent)
}

module.exports.launch = start
module.exports.subUnsub = executeIntent