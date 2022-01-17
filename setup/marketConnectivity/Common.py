from enum import Enum
class LoggingLevel(Enum):
    info = "info"
    debug = "debug"

def log(logger, level, *args, **kwargs):
    if logger is None:
        return
    if LoggingLevel.info == level:
        logger.info(*args, *kwargs)
    elif LoggingLevel.debug == level:
        logger.debug(*args, *kwargs)