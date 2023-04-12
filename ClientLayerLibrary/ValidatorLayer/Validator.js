function validateRequest(request){
    let action = request.action
    if(undefined == action){
        throw {message : `The tag 'action' is missing from the request`}
    }
    
    if(0 == action.localeCompare("subscribe")||
       0 == action.localeCompare("unsubscribe")){
        if(undefined == request.exchange || undefined == request.symbol){
            throw {message : `Please provide both 'exchange' and 'symbol' tags`}
        }
    }
}

module.exports.validateRequest = validateRequest