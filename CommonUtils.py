import logging
from datetime import datetime

def getLoggingLevel(level):
    level_uc = level.upper()
    if level_uc == "ERROR":
        return logging.ERROR
    elif level_uc == "WARN":
        return logging.WARN
    elif level_uc == "INFO":
        return logging.INFO
    elif level_uc == "DEBUG":
        return logging.DEBUG
    else:
        return logging.INFO
    
def getLogger(level, appId):
    logger = logging.getLogger('tcpserver')
    #logger.addHandler(logging.StreamHandler(sys.stdout))
    logger.setLevel(level)
    FORMAT = '%(asctime)-15s %(message)s'
    now = datetime.now()
    date = now.date()
    time = now.time()
    dateSuffix = str(date) + "_" + str(time.hour).zfill(2) + ":" + str(time.minute).zfill(2) + ":" + str(time.second).zfill(2)
    FILENAME= appId + "_" + dateSuffix + ".log"
    logging.basicConfig(format=FORMAT, filename=FILENAME)
    return logger

def generateBinanceTradingPairName(asset, currency):
    return asset + currency

def generateBinanceVirtualTradingPairName(asset, currency, bridge):
    return asset + "_" + currency + "_" + bridge

def extractAssetFromSymbolName(tradingPair, currency):
    return tradingPair[0 : tradingPair.find(currency)]