import asyncio
from enum import Enum
import AsyncEvent
#The startStateFetcher should be a callable returning initial state
#This is done to suppport the state machines which have multiple entry points, so that
#the callable can point to the appropriate starting point depending on the conditions
#in which the state machine was started

class AFSMException(Exception):
    def __init__(self, *args: object) -> None:
        super().__init__(*args)

class FinalityReachedException(AFSMException):
    def __init__(self):
        super().__init__("State machine can't accept events anymore as it has already reached finality")

class EventErrors(Enum):
    unhandledEvent = 'unhandled'
    conditionalReject = 'conditionalReject'

class SpecialEvents(Enum):
    defer = 'defer'

class AFSM:
    def __init__(self, startStateFetcher):
        self.currState = LauncherState(startStateFetcher())
        self.prevState = None
        self.endingEvent = asyncio.Event()
        self.endingNotifier = AsyncEvent.AsyncEvent()
        self.eventQueue = []
        self.deferalQueue = []
        self.conclusion = None

    async def start(self):
        await self.handleEvent("launch")

    async def startAndAwaitEnd(self):
        await self.handleEvent("launch")
        await self.endingEvent.wait()

    async def findNextState(self, evt, *args):
        nextState = await self.currState.react(evt, *args)
        if EventErrors.unhandledEvent == nextState:
            if issubclass(type(self.currState), AFSM):
                try:
                    nextState = await self.currState.handleEvent(evt, *args)
                except FinalityReachedException:
                    pass
            if EventErrors.unhandledEvent != nextState:
                nextState = None
        return nextState

    async def handleStateEntry(self, state):
        res = await state.after_entry()
        childStateMachine = (state  
                             if issubclass(type(state), AFSM) else
                             None)
        if childStateMachine is None:
            return res
        else:
            return await childStateMachine.start()

    async def handleStateExit(self, state):
        childStateMachine = (state  
                            if issubclass(type(state), AFSM) else
                            None)
        if childStateMachine is not None:
            await self.handleStateExit(childStateMachine.currState)
        await state.before_exit()

    async def processEvent(self, evt, *args):
        nextState = await self.findNextState(evt, *args)
        if EventErrors.unhandledEvent == nextState:
            await self.onUnconsumedEvt(evt)
        elif EventErrors.conditionalReject == nextState:
            await self.onConditionalReject(evt)
        elif SpecialEvents.defer == nextState:
            self.deferalQueue.append([evt, args])
        elif nextState != None:
            await self.handleStateExit(self.currState)
            self.prevState = self.currState
            self.currState = nextState
            endResult = await self.handleStateEntry(self.currState)
            if self.currState.isFinal:
                self.conclusion = endResult
                await self.endingNotifier(self.conclusion)
                self.endingEvent.set()
            else:
                await self.processDeferalQueueLoop()

    async def handleEvent(self, evt, *args):
        if(self.currState.isFinal):
            raise FinalityReachedException()
        self.eventQueue.append([evt, args])
        if 1 == len(self.eventQueue):
            await self.processEvtQueueLoop()

    async def processDeferalQueueLoop(self):
        localQueue = []
        localQueue, self.deferalQueue = self.deferalQueue, localQueue
        while 0 < len(localQueue):
            nextEvt = localQueue[0]
            await self.processEvent(nextEvt[0], *nextEvt[1])
            localQueue.pop(0)

    async def processEvtQueueLoop(self):
        while 0 < len(self.eventQueue):
            nextEvt = self.eventQueue[0]
            await self.processEvent(nextEvt[0], *nextEvt[1])
            self.eventQueue.pop(0)

    async def registerForEnd(self, callback):
        self.endingNotifier += callback

    async def onUnconsumedEvt(self, evt):
        pass

    async def onConditionalReject(self, ev2t):
        pass


class AFSMState:
    def __init__(self, isFinal):
        self.isFinal = isFinal

    async def after_entry(self):
        pass

    async def before_exit(self):
        pass

    async def react(self, evt, *args):
        funcName = "on_" + evt
        if hasattr(self, funcName):
            return await getattr(self, funcName)(*args)
        else:
            return EventErrors.unhandledEvent

class CompositeState(AFSMState, AFSM):
    def __init__(self, startStateFetcher):
        AFSMState.__init__(self, False)
        AFSM.__init__(self, startStateFetcher)

class LauncherState(AFSMState):
    def __init__(self, initialState):
        super().__init__(False)
        self.initialState = initialState

    async def on_launch(self):
        return self.initialState