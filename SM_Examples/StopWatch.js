const FSM = require('../AsyncFSM')
const logger = {debug : str=> console.log(str),
                info : str=> console.log(str),
                warn : str=> console.log(str)}

class Camera extends FSM.FSM{
    constructor(){
        super(()=>{ return new Idle()}, logger)
    }
}

class Idle extends FSM.State{
    on_focus(){
        logger.info(`Received "focus" event`)
        return new Focusing()
    }

    on_shoot(){
        logger.info(`Received "shoot" event`)
        return new Shooting()
    }

    on_browse(){
        logger.info(`Received "browse" event`)
        return new Browsing()
    }
}

class Shooting extends FSM.State{
    on_browse(){
        logger.info(`Received "browse" event`)
        return new Browsing()
    }

    on_focus(){
        logger.info(`Received "focus" event`)
        return new Focusing()
    }

}

class Browsing extends FSM.State{
    on_displayImage(imageName){
        logger.info(`Display image, image name: ${imageName}`)
    }

    on_shoot(){
        logger.info(`Received "shoot" event`)
        return new Shooting()
    }
}

class Focusing extends FSM.State{
    on_focused(){
        logger.info(`Received "focused" event`)
        return new Focused()
    }

    on_click(){
        logger.info(`Received "click" deferring it for the time when focus will be completed`)
        return FSM.SpecialTransition.deferralTransition
    }
}

class Focused extends FSM.State{
    on_click(){
        logger.info(`Received "click" event, image clicked!`)
    }
    
    on_buttonReleased(){
        logger.info(`Received "buttonReleased" event`)
        return Idle()
    }
}

// Creating FSM and passing events

const fsm = new Camera()
fsm.start()

try{
    fsm.handleEvent("shoot")
    fsm.handleEvent("focus")
    fsm.handleEvent("click")
    fsm.handleEvent("click")
    fsm.handleEvent("focused")
}
catch(err){
    logger.info(`Exception while placing events, details: ${err.message}`)
}