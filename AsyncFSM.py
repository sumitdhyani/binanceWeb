import asyncio
import AsyncEvent


class AFSM:
    def __init__(self, startState):
        self.startState = startState
        self.currState = LauncherState(self.startState)
        self.prevState = None
        self.endingEvent = asyncio.Event()
        self.endingNotifier = AsyncEvent.AsyncEvent()
        self.eventQueue = []
        self.conclusion = None

    async def start(self):
        await self.handleEvent("launch")

    async def startAndAwaitEnd(self):
        await self.handleEvent("launch")
        await self.endingEvent.wait()

    async def processEvent(self, evt, *args):
        nextState = await self.currState.handleEvent(evt, *args)
        if 'unhandled' == nextState:
            await self.onUnconsumedEvt(evt)
        elif 'conditionalReject' == nextState:
            await self.onConditionalReject(evt)
        elif nextState != None:
            await self.currState.before_exit()
            self.prevState = self.currState
            self.currState = nextState
            endResult = await self.currState.on_entry()
            if self.currState.isFinal:
                self.conclusion = endResult
                await self.endingNotifier(self.conclusion)
                self.endingEvent.set()

    async def handleEvent(self, evt, *args):
        self.eventQueue.append([evt, args])
        if 1 == len(self.eventQueue):
            await self.processEvtQueueLoop()

    async def processEvtQueueLoop(self):
        while 0 < len(self.eventQueue):
            nextEvt = self.eventQueue[0]
            await self.processEvent(nextEvt[0], *nextEvt[1])
            self.eventQueue.pop(0)

    async def registerForEnd(self, callback):
        self.endingNotifier += callback

    async def onUnconsumedEvt(self, evt):
        pass

    async def onConditionalReject(self, evt):
        pass


class AFSMState:
    def __init__(self, context, isFinal):
        self.context = context
        self.isFinal = isFinal

    async def on_entry(self):
        pass

    async def before_exit(self):
        pass

    async def handleEvent(self, evt, *args):
        funcName = "on_" + evt
        if hasattr(self, funcName):
            return await getattr(self, funcName)(*args)
        else:
            return 'unhandled'


class LauncherState(AFSMState):
    def __init__(self, initialState):
        self.initialState = initialState

    async def on_launch(self):
        return self.initialState


############################################################# Unit Tests ######################################
# from datetime import datetime
#
#
# class ProcessStateMachine(AFSM):
#     def __init__(self):
#         super().__init__(Waiting(self))
#
#     async def onUnconsumedEvt(self, evt):
#         print("Invalid event " + evt + " for state " + type(self.currState).__name__ + ", " + str(datetime.now()))
#
#     async def onConditionalReject(self, evt):
#         print("Invalid event " + evt + " in the current context, curr state: " + type(
#             self.currState).__name__ + ", prev state: " + type(self.prevState).__name__)
#
#
# class Waiting(AFSMState):
#     def __init__(self, context):
#         super().__init__(context, False)
#
#     async def on_entry(self):
#         print("Entered waiting state" + ", " + str(datetime.now()))
#         await asyncio.sleep(5)
#         await self.context.handleEvent("attemptStop", "trying to stop")
#         await asyncio.sleep(5)
#         await self.context.handleEvent("attemptResume", "trying to stop")
#         await asyncio.sleep(5)
#         await self.context.handleEvent("attemptRun", "Let's kick off!")
#
#     async def on_attemptRun(self, message):
#         print(message)
#         return Running(self.context)
#
#     async def on_attemptResume(self, message):
#         if (type(self.context.prevState).__name__ == 'Running'):
#             print(message)
#             return Running(self.context)
#         else:
#             return 'conditionalReject'
#
#
# class Running(AFSMState):
#     def __init__(self, context):
#         super().__init__(context, False)
#
#     async def on_entry(self):
#         print("Entered running state")
#         await asyncio.sleep(5)
#         await self.context.handleEvent("attemptStop", "Let's stop")
#
#     async def on_attemptSuspend(self, message):
#         print(message)
#         return Waiting(self.context)
#
#     async def on_signal(self, message):
#         print(message)
#
#     async def on_attemptStop(self, message):
#         print(message)
#         return Stopped(self.context)
#
#
# class Stopped(AFSMState):
#     def __init__(self, context):
#         super().__init__(context, True)
#
#     async def on_entry(self):
#         print("Entered stopping state")
#         return "Stopping the process"
#
#
# async def onEnd(msg):
#     print("Ending hook!")
#     print(msg)
#
#
# async def run():
#     sm = ProcessStateMachine()
#     await sm.registerForEnd(onEnd)
#     await sm.start()
#     # await sm.startAndAwaitEnd()
#     # await asyncio.sleep(200)


#asyncio.run(run())
