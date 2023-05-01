
import './App.css'
import constants from './Constants';
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

function GetWidget(props){
  const onClick = (undefined !== props.onClick)? props.onClick : ()=>{}
  const onChange = (undefined !== props.onChange)? props.onChange : event=>{}
  const className = (undefined !== props.className)? props.className : ""
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
    default:
      break
  }
}

function EditableDropdown(props) {
  const options = props.options
  const onOptionSelected = (undefined !== props.onOptionSelected)? props.onOptionSelected : (evt, value)=>{}
  return (
    <Autocomplete
      options={options}
      onChange={(evt, value)=>{ onOptionSelected(evt, value)} }
      renderInput={(params) => (
        <TextField {...params} variant="outlined" label="Dropdown" />
      )}
    />
  )
}


function EditableTextBox(props) {
  const onChange = (undefined !== props.onChange)? props.onChange : event=>{}
  const className = (undefined !== props.className)? props.className : ""
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
    //console.log(`Tabs: ${tabs}`)
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
                              onSelectCapture={tab.onSelectCapture}
                              className="horizontal_tab"
                           />
                 )
        }
    </div>
  )
}