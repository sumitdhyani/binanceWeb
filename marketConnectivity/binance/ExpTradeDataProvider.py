import asyncio
from typing import Callable, Dict, Set, Awaitable
import AsyncEvent
import json
import time
from unicorn_binance_websocket_api import BinanceWebSocketApiManager

propagationDict = {}
async def propagateUpdate(update, progationFunc):
    symbol = update.get("s")
    if not symbol:
        return
    if symbol not in propagationDict.keys() or time.monotonic() - propagationDict.get(symbol) >= 1.0:
        propagationDict[symbol] = time.monotonic()
        await progationFunc()

class TradeDataProvider:
    """
    Async-friendly dynamic subscriber for Binance via unicorn-binance-websocket-api.
    
    - Callbacks must be async def functions
    - Multiple async callbacks per symbol allowed
    - Automatic subscribe/unsubscribe on Binance when needed
    - Processing runs in asyncio loop (non-blocking)
    
    Usage:
        async def on_trade(data):
            print("Trade:", data['s'], data['p'])
            await asyncio.sleep(0.1)  # example async work
        
        sub = AsyncDynamicBinanceSubscriber(channel="trade")
        await sub.subscribe(on_trade, "BTCUSDT")
        await sub.subscribe(another_async_func, "BTCUSDT")
    """

    def __init__(
        self,
        logger,
        channel: str = "trade",  # 'trade', 'depth@100ms', 'kline_1m' etc.
        exchange: str = "binance.com",
        api_key: str = None,
        api_secret: str = None,
        stream_label: str = "async_dynamic",
        buffer_maxlen: int = 10000
    ):
        self.logger = logger
        self.channel = channel
        self.callbacks = {}  # symbol -> set of async funcs
        self.tagTranslationDictionary= {'s': "symbol", 'p': "price", 'q': "quantity"}

        self.ubwa = BinanceWebSocketApiManager(exchange=exchange)
        #self.ubwa.set_stream_buffer_maxlen(buffer_maxlen)

        # Ek hi stream sab ke liye (multiplex)
        self.stream_id = self.ubwa.create_stream(
            channels=[self.channel],
            markets=[],
            stream_label=stream_label,
            api_key=api_key,
            api_secret=api_secret,
            process_asyncio_queue=self._process_loop
        )

        self.logger.info(f"Created stream {self.stream_id} for channel '{self.channel}'")

    def translate(self, trade):
        for exhangeTag, ourTag in self.tagTranslationDictionary.items():
            trade[ourTag] = trade[exhangeTag]
            del trade[exhangeTag]
        return trade

    async def _process_loop(self, stream_id = None):
        """Async loop: data from asyncio queue and dispatch"""
        self.logger.info(f"Starting process loop for stream {self.stream_id}")
        while not self.ubwa.is_stop_request(self.stream_id):
            try:
                data = await self.ubwa.get_stream_data_from_asyncio_queue(self.stream_id)
                if data:
                    #self.logger.info(f"Received: {data}")
                    await self._dispatch(data)
                self.ubwa.asyncio_queue_task_done(self.stream_id)
            except Exception as e:
                self.logger.error(f"Error in process loop: {e}", exc_info=True)
                await asyncio.sleep(1)  # backoff

    async def _dispatch(self, raw_msg):
        """Symbol extract karo aur uske registered async callbacks fire-and-forget karo"""
        dict = json.loads(raw_msg)
        payload = dict.get("data", {})
        if not payload:
            return

        #self.logger.info(f"Parsed: {raw_msg}")

        async def senderFunc():
            symbol = payload.get("s", "").upper()
            if not symbol or symbol not in self.callbacks:
                return
            asyncio.create_task(self.callbacks[symbol](self.translate(payload)))

        #symbol = payload.get('s', "")
        #self.logger.info(f"Trying to send: {symbol}")
        await propagateUpdate(payload, senderFunc)

    async def subscribe(self, symbol, callback):
        """
        Async callback ko symbol se attach karo.
        Pehli baar symbol add ho to Binance pe subscribe.
        """
        symbol = symbol.upper()

        if symbol not in self.callbacks:
            self.callbacks[symbol] = AsyncEvent.AsyncEvent()

            # Binance pe add (market names must be lowercase)
            self.ubwa.subscribe_to_stream(
                stream_id=self.stream_id,
                markets=[symbol.lower()]
            )
            self.logger.info(f"Subscribed new symbol: {symbol}")

        try:
            self.callbacks[symbol] += callback
            self.logger.info(f"Added async callback for {symbol} (total: {len(self.callbacks[symbol])})")
        except:
            pass


    def unsubscribe(self, symbol, callback):
        """
        Specific async callback ko symbol se remove.
        Agar koi callback nahi bacha to Binance se unsubscribe.
        """
        symbol = symbol.upper()

        if symbol not in self.callbacks:
            return

        try:
            self.callbacks[symbol] -= callback
            if self.callbacks[symbol].empty():
                self.callbacks.pop(symbol)
                self.ubwa.unsubscribe_from_stream(
                    stream_id=self.stream_id,
                    markets=[symbol.lower()]
                )
                self.logger.info(f"Removed subscription from stream for {symbol}")

            self.logger.info(f"Removed async callback for {symbol} (remaining: {len(self.callbacks[symbol])})")
        except:
            pass

    async def stop(self):
        """Cleanup"""
        self.ubwa.stop_manager(with_status_update=True)
        self.logger.info("Stopped subscriber")

# -----------------------
# Usage Example (asyncio)
# -----------------------

# async def main():
#     async def print_trade(data):
#         symbol = data.get('s')
#         price = data.get('p')
#         qty = data.get('q')
#         print(f"TRADE: {symbol} @ {price} (qty: {qty})")
#         await asyncio.sleep(0.05)  # simulate async work

#     async def log_trade(data):
#         print(f"[LOG] {data.get('s')} trade at {data.get('T')}")
#         # await some_db_save(...)  # real async DB call

#     subscriber = AsyncDynamicBinanceSubscriber(channel="trade")

#     await subscriber.subscribe(print_trade, "BTCUSDT")
#     await subscriber.subscribe(print_trade, "ETHUSDT")
#     await subscriber.subscribe(log_trade, "BTCUSDT")

#     try:
#         await asyncio.sleep(300)  # 5 min chalao

#         # Dynamic example
#         await subscriber.subscribe(print_trade, "SOLUSDT")
#         await asyncio.sleep(60)
#         await subscriber.unsubscribe(print_trade, "ETHUSDT")

#     except KeyboardInterrupt:
#         print("Shutting down...")
#     finally:
#         await subscriber.stop()

# if __name__ == "__main__":
#     asyncio.run(main())
