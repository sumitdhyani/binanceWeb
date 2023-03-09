class AFSMError extends Error{
    constructor(message){
        super(message)
        this.name = this.constructor.name 
    }
}

class FinalityReachedException extends AFSMError
{
    constructor(){
        super("State machine has reched final state and can't process any new events")
    }
}

class SMInactiveException extends AFSMError
{
    constructor(){
	    super("State machine needs to be started by calling the start() method")
        this.name = "SMInactiveException"
    }
}

class UnhandledEvtException extends AFSMError
{
    constructor(stateName, evtName){
	    super(`Event: ${evtName} is unhandled in state: ${stateName}`)
    }
}

class ImproperReactionException extends AFSMError
{
    constructor(stateName, evtName, reactionType){
	    super(`Improper reaction from state: ${stateName}, while handling event: ${evtName}, the reaction should be either a new state or a member of "SpecialTransition", but the type of the reaction was of type: ${reactionType}`)
    }
}

class RecursiveEventException extends AFSMError
{
    constructor(){
	    super(`Raising and event on FSM while it is already processing an event`)
    }
}

const SpecialTransition = 
{
	nullTransition : "nullTransition",
	deferralTransition : "deferralTransition"
};

class State
{
	constructor(isFinal = false){
        this.isFinal = isFinal
        this.name = this.constructor.name
    }

    on_launch() { return SpecialTransition.nullTransition }
	onEntry() { }
	beforeExit() {}
	final(){ return this.isFinal }
    react(evtName, evtData)
    {
        let expectedEvtHandlerMethodName = "on_" + evtName
        if(this[expectedEvtHandlerMethodName] == undefined)
            throw new UnhandledEvtException(this.name, evtName)

        let transition = null
        if(evtData == null){
            transition = (this[expectedEvtHandlerMethodName])()
        }
        else{
            transition = (this[expectedEvtHandlerMethodName])(evtData)
        }
        
        if (transition instanceof State){
            this.beforeExit()
            return transition
        }
        else if (SpecialTransition[transition] != undefined){
            return transition
        }
        else{
            throw new ImproperReactionException(this.name, evtName, typeof transition)
        }
    }
}

class FSM
{
	constructor(startStateFetcher, logger = (message)=>{ console.log(message) } )
	{
        this.currState = startStateFetcher()
        this.logger = logger
        this.started = false
        this.smBusy = false//FSM is bust processing an evt
        this.deferralQueue = []
    }

    checkIfFSMReadyToHandleEvt(){
        if (!this.started)
            throw new SMInactiveException()
        else if (this.currState.final())
            throw new FinalityReachedException()
        else if(this.smBusy)
            throw new RecursiveEventException()
    }

	handleEvent(evtName, evtData = null)
	{
        this.checkIfFSMReadyToHandleEvt()
        this.processSingleEvent(evtName, evtData)
	}

    processSingleEvent(evtName, evtData){
        this.smBusy = true
        let transition = null
        try{
            transition = this.currState.react(evtName, evtData)
        }
        finally{
            this.smBusy = false
        }

        this.smBusy = false
        if(transition instanceof State){
            this.currState = transition
            this.handleStateEntry(this.currState)
        }
        else if(SpecialTransition.deferralTransition == transition){
            this.deferralQueue.push([evtName, evtData])
        }
    }

	start()
	{
		this.started = true
        if (this.currState.final())
            throw new FinalityReachedException()
        this.handleStateEntry(this.currState)
	}

	processDeferralQueue(){
        if (0 == this.deferralQueue.length){
            return
        }

		let local = []
        let temp = local
        local = this.deferralQueue
        this.deferralQueue = temp
		
		while (0 < local.length){
            try{
                this.checkIfFSMReadyToHandleEvt()
                let [evtName, evtData] = local[0]
                this.processSingleEvent(evtName, evtData)
            }
            catch(err){
                this.logger(`Error while processing deferral queue: ${err.message}`)
            }
            finally{
                local.pop()
            }
		}
	}
	
	handleStateEntry(state){
		state.onEntry()
        this.handleEvent("launch")
		this.processDeferralQueue()
	}
};

class CompositeState extends State
{
	constructor(startStateFetcher, 
                evtProcessorDictionary,
                 isFinal = false)
	{
        super(evtProcessorDictionary, isFinal)
        this.fsm = new FSM(startStateFetcher)
        this.fsm.start()
    }

    react(name, evtData)
    {
        try{
            transition = super.react(name, evtData)
            if(transition instanceof State){
                this.fsm.currState.beforeExit()
                return transition
            }
        }
        catch(err){
            if(!(err instanceof UnhandledEvtException)){
                throw err
            }
        }

        try{
            this.fsm.handleEvent(evt)
        }
        catch(err){
            if(!(err instanceof FinalityReachedException)){
                throw err
            }
        }
        return SpecialTransition.nullTransition
    }
}

module.exports.FSM = FSM
module.exports.State = State
module.exports.CompositeState = CompositeState
module.exports.FinalityReachedException = FinalityReachedException
module.exports.SMInactiveException = SMInactiveException
module.exports.UnhandledEvtException = UnhandledEvtException
module.exports.ImproperReactionException = ImproperReactionException
module.exports.SpecialTransition = SpecialTransition