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
    now = datetime.now()
    date = now.date()
    time = now.time()
    #dateSuffix = str(date) + "_" + str(time.hour).zfill(2) + ":" + str(time.minute).zfill(2) + ":" + str(time.second).zfill(2)
    dateSuffix = str(date)
    FILENAME= "./Logs/" + appId + "_" + dateSuffix + ".log"

    logger = logging.getLogger('tcpserver')
    logger.setLevel(level)
    formatter = logging.Formatter('%(asctime)s:%(levelname)s : %(name)s : %(message)s')
    file_handler = logging.FileHandler(FILENAME)
    file_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    return logger

def generateBinanceTradingPairName(asset, currency):
    return asset + currency

def generateBinanceVirtualTradingPairName(asset, currency, bridge):
    return asset + "_" + currency + "_" + bridge

def extractAssetFromSymbolName(tradingPair, currency):
    return tradingPair[0 : tradingPair.find(currency)]