function validateRequest(request){
    let action = request.action
    if(0 == action.localeCompare("subscribe")||
       0 == action.localeCompare("unsubscribe")){
        if(undefined == request.exchange){
            throw {message : "The tag 'exchange' is missing from the request"}
        }
    }
}

module.exports.validateRequest = validateRequest