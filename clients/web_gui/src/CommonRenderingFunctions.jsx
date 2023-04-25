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

export function vertical_tabs(tabs) {
  return (
      <div className="vertical_tabs">
      {tabs.map((tab) => (
        <tab className="horizontal_tab" onClick={ ()=>{ if(undefined !== tab.onClick){
          tab.onClick()
        } }}>{tab.title}</tab>
      ))}
    </div>
  );
}