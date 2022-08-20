from enum import Enum
class TrailingStopParams(Enum):
    symbol = "symbol"
    side = "side"
    activationPrice = "activationPrice"
    quantity = "quantity"
    quoteOrderQty = "quoteOrderQty"
    trailSize = "trailSize"
    clientOrderId = "newClientOrderId"

class RatioScaledTrailingStopParams(Enum):
    symbol = "symbol"
    side = "side"
    activationTrailSize = "activationTrailSize"
    basePrice = "basePrice"
    quantity = "quantity"
    quoteOrderQty = "quoteOrderQty"
    trailRatio = "trailRatio"
    clientOrderId = "newClientOrderId"

class OrderAttributes(Enum):
    status = "status"
    reason = "reason"

class MsgTypes(Enum):
    newOrderRequest = "newOrderRequest"
    cancelOrderRequest = "cancelOrderRequest"
    
class AlgoOrderTypes(Enum):
    trailingStopMktOrder = "trailingStopMktOrder"
    ratioScaledTrailingStopMktOrder = "ratioScaledTrailingStopMktOrder"
    arbitrageOrder = "arbitrageOrder"

class Tags(Enum):
    msgType = "msgType"
    orderType = "orderType"
    symbol = "symbol"
    bids = "bids"
    asks = "asks"
    state = "state"

class TagGroups(Enum):
    orderParams = "orderParams"

