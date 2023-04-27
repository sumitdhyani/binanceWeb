
import './App.css'

export function HorizontalTabs(props) {
    const tabs = props.tabs
    console.log(`Tabs: ${tabs}`)
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

export function VerticalTabs(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((item, index) => (
        <div className="row" key={index}>
          <button className="button">-</button>
          <button className="button">&#9660;</button>
          <tab className="tab">{item.content}</tab>
        </div>
      ))}
    </div>
  );
}