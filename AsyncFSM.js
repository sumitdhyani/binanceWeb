#include <memory>
#include <functional>
#include <queue>
#include <variant>

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
    constructor(state, evt, reaction){
	    super(`Improper reaction from state: ${state.name}, while handling event: ${evt.name} the reaction should be either a new state or a member of "SpecialTransition", but the type of the reaction was of type: ${reaction.name}`)
    }
}
const Specialtransition = 
{
	nullTransition : "nullTransition",
	deferralTransition : "deferralTransition"
};

class State
{
	constructor(evtProcessorDictionary, isFinal = false){
        this.isFinal = isFinal
        this.name = this.constructor.name
        this.evtProcessorDictionary = evtProcessorDictionary
    }

	onEntry() {};
	beforeExit() {};
	isFinal(){	return m_isFinal; }
    react(name, evtData)
    {
        if(this.evtProcessorDictionary.has(name)){
            return this.evtProcessorDictionary[name](evtData)
        }
        else{
            throw UnhandledEvtException(this.name, name)
        }
    }
};

class FSM
{
	constructor(startStateFetcher)
	{
        this.currState = startStateFetcher()
        this.started = false
        this.deferralQueue = []
    }

	handleEvent(evt)
	{
		onEvent(evt);
	}

	start()
	{
		this.started = true;
		if (this.currState.isFinal())
			throw FinalityReachedException();
		else
			handleStateEntry(this.currState);
	}

	onEvent(name, evtData)
	{
        if (!this.started)
            throw SMInactiveException();
        else if (this.currState.isFinal())
            throw FinalityReachedException();

        transition = this.currState.react(name, evtData)
        if(transition instanceof State){
            nextState = transition
            handleStateExit(this.currState)
            m_currState = nextState
            handleStateEntry(this.currState)
        }
        else if(Specialtransition.deferralTransition == transition){
            this.deferralQueue.push(()=>{ this.handleEvent(name, evtData)})
        }
	}

	processDeferralQueue()
	{
		local = []
        temp = local
        local = this.deferralQueue
        this.deferralQueue = temp

        local.swap(deferralQueue)

		local.swap(m_deferralQueue);
		
		while (0 < local.length)
		{
            local[0]()
            local.pop()
		}
	}
	
	handleStateEntry(state)
	{
		state.onEntry();
		processDeferralQueue();
	}

	handleStateExit(state)
	{
        if(state instanceof CompositeState){
            state.compositeStateExit()
        }
        else{
		    state.beforeExit()
        }
	}
};

class CompositeState extends State
{
	constructor(startStstefetcher, 
                evtProcessorDictionary,
                 isFinal = false)
	{
        super(evtProcessorDictionary, isFinal)
        this.fsm = new FSM(startStateFetcher)
        this.fsm.start()
    }

    compositeStateExit(){
        this.beforeExit()
    }

    react(name, evtData)
    {
        try{
            transition = super.react(name, evtData)
            if(transition instanceof State)
                return transition
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
            else{
                return Specialtransition.nullTransition
            }
        }
    }
}
