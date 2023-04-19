import logo from './logo.svg';
import {useState, useEffect} from 'react'
import start from './InputTaker'
import './App.css';
const {init, subscribe, unsubscribe, subscribeVirtual, unsubscribeVirtual} = require('./Gui-Library-Interface')
const {Visual, initRendering} = require('./ContentRoot')
function depthComponent(levels){
  return (
    levels.map((level) => <h1>Price: {level[0]}, Qty: {level[1]}</h1>)
  );
}

function MyComponent(props) {

  return (
    props.store.map((data) => <h1>Id: {JSON.stringify([data.symbol, data.exchange])}, Bids: {depthComponent(data.bids)}, Asks: {depthComponent(data.asks)}</h1>)
  );
}

const logger = { debug : str => console.log(str),
  info : str => {},
  warn : str => console.log(str),
  error : str => console.log(str)
 }

let instrumentStore = new Map()
function App() {
  const [libraryInitialized, setLibraryInitialized] = useState(false)
  const [firstRender, setFirstRender] = useState(true)

  if(firstRender){
    setFirstRender(false)
    logger.warn(`Initializing the library`)
    init({auth_server : "http://127.0.0.1:90", credentials : {user : "test_user", password : "test_pwd"}},
      logger,
      (symbolDict)=>{
       logger.warn(`Downloaded symbols`)
       instrumentStore = symbolDict
       logger.warn(`Library initialized`)
       initRendering()
       setLibraryInitialized(true)})
  }

  if(libraryInitialized){
    return (
      <Visual />
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
