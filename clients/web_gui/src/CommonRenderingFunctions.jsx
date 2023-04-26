import './App.css'

export function horizontal_tabs(tabs) {
    return (
        <div className="horizontal_tabs">
        {tabs.map((tab) => (
          <button className="horizontal_tab" onClick={ ()=>{ if(undefined !== tab.onClick){
            tab.onClick()
          } }}>{tab.title}</button>
        ))}
      </div>
    );
}

export function vertical_tabs(data) {
  return (
    <div className="container">
      {data.map((item, index) => (
        <div className="row" key={index}>
          <button className="button">-</button>
          <button className="button">&#9660;</button>
          <tab className="tab">{item.content}</tab>
        </div>
      ))}
    </div>
  );
}