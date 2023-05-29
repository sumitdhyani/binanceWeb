import logging, asyncio
from datetime import datetime
from asyncio import create_task

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

async def timer(sec, func, cont):
    async def internalFunc():
        await func()
        await asyncio.sleep(sec)
        if cont[0]:
            await timer(sec, func, cont)
    await asyncio.wait([create_task(asyncio.sleep(0)), create_task(internalFunc())], return_when=asyncio.FIRST_COMPLETED)
    
class Timer:
    def __init__(self) -> None:
        self.timer_table = {}
    
    async def setTimer(self, sec, func):
        cont = [True]
        self.timer_table[func] = cont
        await timer(sec, func, cont)
    
    async def unsetTimer(self, func):
        if func in self.timer_table.keys():
            (self.timer_table[func])[0] = False
            self.timer_table.pop(func)
         
