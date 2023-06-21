import Visual from './ContentRoot'
import {useEffect, useState} from 'react'
import './App.css';
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./Gui-Library-Interface')
const logger = { debug : str => console.log(str),
  info : str => console.log(str),
  warn : str => console.log(str),
  error : str => console.log(str)
 }

let instrumentStore = new Map()
function App() {
  const [libraryInitialized, setLibraryInitialized] = useState(false)

  useEffect(()=>{
    logger.warn(`Initializing the library`)
    init({auth_server : "http://206.81.18.17:90", credentials : {user : "test_user", password : "test_pwd"}},
    //init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
         logger,
         (symbolDict)=>{
          logger.warn(`Downloaded symbols`)
          instrumentStore = symbolDict
          logger.warn(`Library initialized`)
          setLibraryInitialized(true)})
    return ()=>{}
  },[])
  
  function getQuoteBasedDictionary(dict){
    const quoteBasedDictionary = new Map()
    let arr = [...dict.values()]
    arr.forEach(item =>{
      const exchange = item.exchange
      if(undefined === quoteBasedDictionary.get(exchange)){
        quoteBasedDictionary.set(exchange, new Map())
      }

      const exchangeLevelBook = quoteBasedDictionary.get(exchange)
      const quoteAsset = item.quoteAsset
      if(undefined === exchangeLevelBook.get(quoteAsset)){
        exchangeLevelBook.set(quoteAsset, new Set())
      }

      const symbolSet = exchangeLevelBook.get(quoteAsset)
      symbolSet.add(item)
    })
  }

  let nativeAssetList = new Map()
  let nativeCurrencyList = new Map()
  
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
    const context = { symbol_dict : instrumentStore,
                      subscription_functions : {subscribe : subscribe, unsubscribe : unsubscribe},
                      virtual_subscription_functions : {subscribe : subscribeVirtual, unsubscribe : unsubscribeVirtual},
                      native_assets : nativeAssetList,
                      native_currencies : nativeCurrencyList,
                      exchanges : ["BINANCE"]
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
