function validateRequest(request){
    if(undefined == request.exchange){
        throw {message : "The tag 'exchange' is missing from the request"}
    }
}

module.exports.validateRequest = validateRequest