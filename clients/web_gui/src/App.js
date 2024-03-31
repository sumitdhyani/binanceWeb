import Visual from './ContentRoot'
import {useEffect, useState} from 'react'
import './App.css';
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./Gui-Library-Interface')
const logger = { debug : str => console.log(str),
  info : str => console.log(str),
  warn : str => console.log(str),
  error : str => console.log(str)
 }

let defaultCurrencies = new Map()
let instrumentStore = new Map()
function App() {
  const [libraryInitialized, setLibraryInitialized] = useState(false)

  useEffect(()=>{
    logger.warn(`Initializing the library`)
    init({auth_server : ["http://165.232.187.129:90","http://143.244.139.3:90","http://143.244.131.67:90"], credentials : {user : "test_user", password : "test_pwd"}},
    //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
         logger,
         (symbolDict)=>{
          instrumentStore = symbolDict
          logger.warn(`Library initialized`)
          setLibraryInitialized(true)})
    return ()=>{}
  },[])
  
  function getExchangeKeyedSymbolDict(dict){
    const exchangeKeyedSymbolDict = new Map()
    dict.forEach((item, key)=>{
      const exchange = item.exchange
      if(undefined === exchangeKeyedSymbolDict.get(exchange)){
        exchangeKeyedSymbolDict.set(exchange, new Map())
      }

      const exchangeLevelBook = exchangeKeyedSymbolDict.get(exchange)
      exchangeLevelBook.set(key, item)
    })

    return exchangeKeyedSymbolDict
  }

  let nativeAssetList = new Map()
  let nativeCurrencyList = new Map()
  let exchangeKeyedSymbolDict = getExchangeKeyedSymbolDict(instrumentStore)
  defaultCurrencies.set("BINANCE", "USDT")
  instrumentStore.forEach((instrument , key)=>{
    const exchange = instrument.exchange
    let assetListForThisExchange = nativeAssetList.get(exchange)
    let currencyListForThisExchange = nativeCurrencyList.get(exchange)
    if(undefined === assetListForThisExchange){
      assetListForThisExchange = new Set()
      nativeAssetList.set(exchange, assetListForThisExchange)
    }

    if(undefined === currencyListForThisExchange){
      currencyListForThisExchange = new Set()
      nativeCurrencyList.set(exchange, currencyListForThisExchange)
    }

    assetListForThisExchange.add(instrument.baseAsset)
    currencyListForThisExchange.add(instrument.quoteAsset)
  })

  console.log(`render Cycle, libraryInitialized : ${libraryInitialized}`)
  if(libraryInitialized){
    const context = { symbol_dict : exchangeKeyedSymbolDict.get("BINANCE"),
                      subscription_functions : {subscribe : subscribe, unsubscribe : unsubscribe},
                      virtual_subscription_functions : {subscribe : subscribeVirtual, unsubscribe : unsubscribeVirtual},
                      native_assets : nativeAssetList.get("BINANCE"),
                      native_currencies : nativeCurrencyList.get("BINANCE"),
                      exchanges : ["BINANCE"],
                      default_currency : defaultCurrencies.get("BINANCE")
                    }
    return (
      <Visual context={context}/>
    );
  }else{
    return (
      <>Before Init</>
    );
  }  
}

//function App() {
//  const [dataArray, setDataArray] = useState([])
//
//  if(!started){
//    start((data) => {
//      setDataArray([...data.values()])
//    }).then(()=>{})
//
//    started = true
//  }
//
//
//  return (
//    <div className="App">
//      <MyComponent store={dataArray}/>
//    </div>
//  );
//}

export default App;
