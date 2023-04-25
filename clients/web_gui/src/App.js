import Visual from './ContentRoot'
import {useEffect, useState} from 'react'
import './App.css';
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
  

    console.log(`render Cycle, libraryInitialized : ${libraryInitialized}`)
    if(libraryInitialized){
      const context = { symbol_dict : instrumentStore,
                        subscribe : subscribe,
                        unsubscribe : unsubscribe,
                        subscribeVirtual : subscribeVirtual,
                        unsubscribeVirtual : unsubscribeVirtual}
    return (
      <Visual context={context}/>
    );
  }else{
    return (
      <>Before libInit</>
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
