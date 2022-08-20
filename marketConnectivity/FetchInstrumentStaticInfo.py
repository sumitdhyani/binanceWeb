import asyncio
import binance
import Keys

async def run():
    client = await binance.AsyncClient.create(api_key=Keys.PUBLIC, api_secret=Keys.SECRET)
    try:
        print(await client.get_symbol_ticker('ADAETH'))
        print(await client.get_order_book(symbol='ADAETH'))
    except binance.exceptions.BinanceAPIException as ex:
        print(str(ex))

    await client.close_connection()
    print("Exiting application")

#asyncio.run(run())
