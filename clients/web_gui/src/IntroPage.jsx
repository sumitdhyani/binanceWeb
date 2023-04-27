import { useEffect } from 'react'
import './App.css'
import { HorizontalTabs } from './CommonRenderingFunctions'
function IntroPage(props){
    useEffect(()=>{
        console.log(`IntroPage render`)
        return ()=> console.log(`IntroPage un-render`)
    },
    [])

    return(<HorizontalTabs tabs={[{title: "Intro Page"}]}/>)
}
export default IntroPage
