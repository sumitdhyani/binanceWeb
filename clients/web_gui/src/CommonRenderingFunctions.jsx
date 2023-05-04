
import './App.css'
import constants from './Constants';
import { useState, React, useEffect, useCallback } from 'react';
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
      console.log(`Unrecognized Widget Id: ${props.widget_id}`)
      break
  }
}

function EditableDropdown(props) {
  const options = props.options
  const className = (undefined !== props.className)? props.className : ""
  const onOptionSelected = (undefined !== props.onOptionSelected)? props.onOptionSelected : (evt, value)=>{}
  const nameConverter = (undefined !== props.nameConverter)? props.nameConverter : orig=>orig
  return (
    <Autocomplete
      className={className}
      options={options}
      onChange={(evt, value)=>{ 
        console.log(`Option selected: ${value}`)
        onOptionSelected(evt, value)
      }}
      getOptionLabel={option=>nameConverter(option)}
      renderInput={(params) => (
        <TextField {...params} variant="outlined"/>
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

function VerticalTabForVanillaPrices(props){
  const [currUpdate, setCurrUpdate] = useState(null)
  const [tab, index] = [props.tab, props.index]
  const priceCallback = useCallback((update)=>{
    //console.log(`Update received: ${JSON.stringify(update)}`)
    setCurrUpdate(update)
  })

  useEffect(()=>{
    tab.rendering_action(priceCallback)
    return ()=>{ tab.auto_unsubscribe_action(priceCallback)}
  },[])
  return (
    <div className="row" key={index}>
      <GetWidget className="button" title="-" widget_id={constants.widget_ids.button} onClick={()=>tab.user_unsubscribe_action(priceCallback)}/>
      <GetWidget className="button" title="&#9660;" widget_id={constants.widget_ids.button}/>
      <h4 className="tab">{tab.content} {"=>"} {currUpdate? [currUpdate.bids[0][0], "|", currUpdate.bids[0][1],  "<==>", currUpdate.asks[0][0], "|", currUpdate.asks[0][1]] : ""}</h4>
    </div>
  )

}

export function VerticalTabsForVanillaPrices(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((tab, index) => <VerticalTabForVanillaPrices tab={tab} index={index} key={index}/>)}
    </div>
  );
}

export function SearchBoxRow(props) {
  const tabs = props.tabs
  //console.log(`Tabs: ${tabs}`)
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
  const nameConverter = props.nameConverter

  console.log(`Tabs: ${tabs}`)
  return (
    <div className="horizontal_tabs">
        {tabs.map((tab) => <GetWidget {...tab}
                              nameConverter = {nameConverter}
                              widget_id={constants.widget_ids.editable_drop_down}
                              className="horizontal_tab"
                           />
                 )
        }
    </div>
  )
}