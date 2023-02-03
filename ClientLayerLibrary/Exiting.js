FSM = require('../AsyncFSM')
const State = FSM.State

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

module.exports.Exiting = function (params){ return new Exiting(params) }
