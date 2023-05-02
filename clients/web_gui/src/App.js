import Visual from './ContentRoot'
import {useEffect, useState} from 'react'
import './App.css';
import constants from './Constants';
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./Gui-Library-Interface')
const logger = { debug : str => console.log(str),
  info : str => {},
  warn : str => console.log(str),
  error : str => console.log(str)
 }

let instrumentStore = new Map()
function App() {
  const [libraryInitialized, setLibraryInitialized] = useState(false)

  useEffect(()=>{
    logger.warn(`Initializing the library`)
    init({auth_server : "http://206.81.18.17:90", credentials : {user : "test_user", password : "test_pwd"}},
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


    console.log(`render Cycle, libraryInitialized : ${libraryInitialized}`)
    if(libraryInitialized){
      const context = { symbol_dict : instrumentStore,
                        subscription_functions : {subscribe : subscribe, unsubscribe : unsubscribe},
                        virtual_subscription_functions : {subscribe : subscribeVirtual, unsubscribe : unsubscribeVirtual}
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
