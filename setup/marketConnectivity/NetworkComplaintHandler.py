import asyncio
from asyncio.unix_events import SelectorEventLoop
from urllib import request, error

class NetworkComplaintHandler:
    def __init__(self, url) -> None:
        self.url = url
        self.evt = asyncio.Event()
        self.checkConnStatusLoopRunning = False

    async def registerComplaint(self):
        if not self.checkConnStatusLoopRunning:
            self.checkConnStatusLoopRunning = True
            await asyncio.wait([asyncio.sleep(0), self.checkConnStatusLoop()], return_when=asyncio.FIRST_COMPLETED)
        await self.evt.wait()
    
    async def checkConnStatusLoop(self):
        while not self.checkConnectionStatus():
            await asyncio.sleep(1)
        self.evt.set()
        self.checkConnStatusLoopRunning = False

    def checkConnectionStatus(self):
        try:
            return request.urlopen(self.url).getcode() == 200
        except error.URLError:
            return False

