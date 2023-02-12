import asyncio
import binance

class DepthManagerWrapper(binance.DepthCacheManager):
    def __init__(self, client, symbol, loop=None, refresh_interval=None, bm=None, limit=10, conv_type=float):
        super().__init__(client, symbol, loop=loop, refresh_interval=refresh_interval, bm=bm, limit=10, conv_type=conv_type)

    async def recv(self):
        return await self._depth_event(await asyncio.wait_for(self._socket.recv(), timeout=self.TIMEOUT))