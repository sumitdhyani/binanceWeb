import logo from './logo.svg';
import start from './InputTaker'
import './App.css';

let dataStoreArray = []
function dataCallback(data){
  dataStoreArray = [...data.values()]
}

start(dataCallback).then(()=>{})



function MyComponent() {

  return (
    dataStoreArray.map(data => <h1>Data: {JSON.stringify(data)}</h1>)
  );
}


function App() {
  return (
    <div className="App">
      <MyComponent />
    </div>
  );
}

export default App;
