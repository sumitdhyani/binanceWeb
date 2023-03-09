const FSM = require('../../AsyncFSM').FSM
const Authenticating = require('./AllStates.js').Authenticating

class ClientLayerFSM extends FSM{
    constructor(params){
        super(()=>{ return new Authenticating(params)}, params.logger)
    }
}

module.exports.ClientLayerFSM = ClientLayerFSM
