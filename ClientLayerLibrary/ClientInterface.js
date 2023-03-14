const https = require('http')
const { ClientLayerFSM } = require("./StateMachine/ClientLayerFSM")
const Validator = require("./ValidatorLayer/Validator")
const NetworkServices = require("./NetworkLayer/RequestForwarder")
const fs = require('fs')
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

async function download_instruments(){
  const symbolDict = new Map()
  const data = fs.readFileSync('symbols.txt', {encoding:'utf8', flag:'r'})
    instrumentList = data.split(/\r\n|\r|\n/)
    for(let instrument of instrumentList){
        dict = JSON.parse(instrument)
        const desc = dict["baseAsset"] + " vs " + dict["quoteAsset"]
        dict["description"] = desc
        symbol = dict["symbol"]
        symbolDict.set(symbol, dict)
    }
    
    return symbolDict
}

module.exports.launch = start
module.exports.subUnsub = executeIntent
module.exports.download_instruments = download_instruments