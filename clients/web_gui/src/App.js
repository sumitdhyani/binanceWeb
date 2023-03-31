import logo from './logo.svg';
import {useState, useEffect} from 'react'
import start from './InputTaker'
import './App.css';



function MyComponent(props) {

  return (
    props.store.map((data) => <h1>Data: {data}</h1>)
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
