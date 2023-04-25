import { useEffect } from 'react'
import './App.css'
import { horizontal_tabs } from './CommonRenderingFunctions'
function IntroPage(props){
    useEffect(()=>{
        console.log(`IntroPage render`)
        return ()=> console.log(`IntroPage un-render`)
    },
    [])

    return(<>{horizontal_tabs([{title: "Intro Page"}])}</>)
}
export default IntroPage
