
import './App.css'
import { constants } from './root/ClientLayerLibrary/Constants'
import React, { useState, useEffect, useCallback, useRef} from 'react';
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
        evt.preventDefault()
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
        {tabs.map((tab, index) => <GetWidget {...tab} key={index} className="horizontal_tab"/>)}
      </div>
    );
}

const VerticalTabForVanillaPrices = React.memo((props)=>{
  const tab = props.tab
  return (
    <div className="row">
      <GetWidget className="button" title="-" widget_id={constants.widget_ids.button} onClick={()=>tab.user_unsubscribe_action()}/>
      <GetWidget className="button" title="&#9660;" widget_id={constants.widget_ids.button}/>
      <h4 className="tab">{tab.symbol} {"=>"} {tab.update? [tab.update.bids[0][0], "|", tab.update.bids[0][1],  "<==>", tab.update.asks[0][0], "|", tab.update.asks[0][1]] : ""}</h4>
    </div>
  )
});

export function VerticalTabsForVanillaPrices(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((tab, index) => <VerticalTabForVanillaPrices tab={tab} key={index} index={index}/>)}
    </div>
  );
}

const VerticalTabForCrossPrices = React.memo((props)=>{
  const tab = props.tab
  return (
    <div className="row">
      <GetWidget className="button" title="-" widget_id={constants.widget_ids.button} onClick={()=>tab.user_unsubscribe_action()}/>
      <h4 className="tab">{tab.symbol} {"=>"} {tab.update? [tab.update.bids[0][0], "|", tab.update.bids[0][1],  "<==>", tab.update.asks[0][0], "|", tab.update.asks[0][1]] : ""}</h4>
    </div>
  )
});

export function VerticalTabsForCrossPrices(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((tab, index) => <VerticalTabForCrossPrices tab={tab} key={index} index={index}/>)}
    </div>
  );
}

const VerticalTabForBasketPrices = React.memo((props)=>{
  const tab = props.tab
  return (
    <div className="row">
      <GetWidget className="button" title="-" widget_id={constants.widget_ids.button} onClick={()=>tab.user_unsubscribe_action()}/>
      <h4 className="tab">{tab.symbol} {"=>"} {tab.update? [tab.update.bids[0][0], "|", tab.update.bids[0][1],  "<==>", tab.update.asks[0][0], "|", tab.update.asks[0][1]] : ""}</h4>
    </div>
  )
});

export function VerticalTabsForBasketPrices(props) {
  const tabs = props.tabs
  return (
    <div className="container">
      {tabs.map((tab, index) => <VerticalTabForBasketPrices tab={tab} key={index} index={index}/>)}
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

const EditableDropdownRow = React.memo((props)=> {
  const tabs = props.tabs
  const nameConverter = props.nameConverter

  //console.log(`Tabs: ${tabs}`)
  return (
    <div className="horizontal_tabs">
        {tabs.map((tab, index) => <GetWidget {...tab}
                              nameConverter = {nameConverter}
                              widget_id={constants.widget_ids.editable_drop_down}
                              className="horizontal_tab"
                              key={index}
                           />
                 )
        }
    </div>
  )
});

export {EditableDropdownRow}