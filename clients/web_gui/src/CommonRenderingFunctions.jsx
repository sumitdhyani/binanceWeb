
import './App.css'
import constants from './Constants';
import { useState } from 'react';

function GetWidget(props){
  const onClick = (undefined !== props.onClick)? props.onClick : ()=>{}
  const onChange = (undefined !== props.onChange)? props.onChange : event=>{}
  const className = (undefined != props.className)? props.className : ""
  switch(props.widget_id) {
    case constants.widget_ids.button:
          return (<button className={className} onClick={onClick}>
                    {props.title}
                  </button>)
    case constants.widget_ids.editable_text_box:
      return (<EditableTextBox {...props}/>)            
    case constants.widget_ids.tab:
      return <tab className={className}>{props.content}</tab>
    case constants.widget_ids.editable_drop_down:
      return (<EditableDropdown {...props} className={className}/>)
  }
}

function EditableDropdown(props) {
  const dataListId = "options_" + Math.random().toString(36).substring(2, 9); // Generate a unique id for the datalist
  const [options, initialValue] = [props.options, props.value]
  const onChange = (undefined !== props.onChange)? props.onChange : event=>{}
  const [value, setValue] = useState(initialValue)
  return (
    <div>
      <input
        list={dataListId}
        value={value}
        onChange={(event) => {
                    setValue(event.target.value)
                    onChange(event.target.value)
                  }
        }
      />
      <datalist id={dataListId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}


function EditableTextBox(props) {
  const onChange = (undefined !== props.onChange)? props.onChange : event=>{}
  const className = (undefined != props.className)? props.className : ""
  const [value, setValue] = useState(props.value);

  return (
    <div>
      <input type="text" className={className} value={value} 
        onChange={(event) => {
          setValue(event.target.value)
          onChange(event.target.value)
        }} 
      />
    </div>
  );
}

export function HorizontalTabs(props) {
    const tabs = props.tabs
    console.log(`Tabs: ${tabs}`)
    return (
        <div className="horizontal_tabs">
        {tabs.map((tab) => <GetWidget {...tab} className="horizontal_tab"/>)}
      </div>
    );
}

export function VerticalTabs(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((item, index) => (
        <div className="row" key={index}>
          <GetWidget {...props} className="button" title="-"/>
          <GetWidget {...props} className="button" title="&#9660;"/>
          <tab className="tab">{item.content}</tab>
        </div>
      ))}
    </div>
  );
}



export function SearchBoxRow(props) {
  const tabs = props.tabs
  console.log(`Tabs: ${tabs}`)
  return (
    <div className="horizontal_tabs">
        {tabs.map((tab) => <GetWidget {...tab} 
                              widget_id={constants.widget_ids.editable_text_box}
                              className="horizontal_tab"
                           />
                 )
        }
    </div>
  )
}

export function EditableDropdownRow(props) {
  const tabs = props.tabs
  console.log(`Tabs: ${tabs}`)
  return (
    <div className="horizontal_tabs">
        {tabs.map((tab) => <GetWidget {...tab}
                              widget_id={constants.widget_ids.editable_drop_down}
                              className="horizontal_tab"
                           />
                 )
        }
    </div>
  )
}