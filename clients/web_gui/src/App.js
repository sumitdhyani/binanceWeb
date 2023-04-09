import logo from './logo.svg';
import {useState, useEffect} from 'react'
import start from './InputTaker'
import './App.css';

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

let started = false
function App() {
  const [dataArray, setDataArray] = useState([])

  if(!started){
    start((data) => {
      setDataArray([...data.values()])
    }).then(()=>{})

    started = true
  }

  return (
    <div className="App">
      <MyComponent store={dataArray}/>
    </div>
  );
}

export default App;
