const {createLogger, format, transports} = require('winston')
const {combine, timestamp, label, printf} = format
const {Event} = require('./IndependentCommonUtils/CommonUtils')
const logFormat = printf(({level, message, timestamp}) => {
    return `${timestamp} ${level}: ${message}`
})

function createFileLogger(file, level){
    return createLogger({
        //format : winston.format.simple(),
        format : combine(format.colorize(), 
                         timestamp({format : 'YYYY-MM-DD HH:mm:ss'}),
                         logFormat),
        transports : [new transports.File({filename: file})],
        level : level
    })
}

function createTradingPairName(asset, currency)
{
    return asset + currency
}

function createVirtualTradingPairName(asset, currency, bridge)
{
    return asset + "_" + currency + "_" + bridge
}

function disintegrateVirtualTradingPairName(virtualSymbol)
{
    return virtualSymbol.split("_")
}

module.exports.createFileLogger = createFileLogger
module.exports.Event = Event
module.exports.createTradingPairName = createTradingPairName
module.exports.createVirtualTradingPairName = createVirtualTradingPairName
module.exports.disintegrateVirtualTradingPairName = disintegrateVirtualTradingPairName

