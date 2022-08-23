import inspect, asyncio
from AppSpecificErrors import DuplicateSubscription, SpuriousUnsubscription, InvalidCallbackFormat, InvalidEventInvokation


class AsyncEvent:
    def __init__(self):
        self.callbackSets = [set(), set(), set(), set(), set()]

    def getNumArgs(self, function):
        argList = inspect.getfullargspec(function)[0]
        numArgs = len(argList)
        if 0 < numArgs and 'self' == argList[0]:
            numArgs -= 1
        return numArgs

    def __iadd__(self, function):
        numArgs = self.getNumArgs(function)
        if numArgs >= len(self.callbackSets):
            raise InvalidCallbackFormat("Too many params required by callback, max should be: " + str(len(self.callbackSets)) )
                        
        callbackSet =  self.callbackSets[numArgs]
        if function not in callbackSet:
            callbackSet.add(function)
        else:
            raise DuplicateSubscription("Attempt to register the callback more than once")

        return self

    def __isub__(self, function):
        numArgs = self.getNumArgs(function)
        if numArgs >= len(self.callbackSets):
            raise InvalidCallbackFormat()
        callbackSet =  self.callbackSets[numArgs]
        
        try:
            callbackSet.remove(function)
            return self
        except:
            raise Exception("Function is not a member of observer list")

    async def __call__(self, *args, **kwargs):
        numArgs = len(args)
        if numArgs > len(self.callbackSets):
            raise InvalidEventInvokation()

        callbackSet =  self.callbackSets[numArgs]
        await asyncio.gather(*[callback(*args) for callback in callbackSet])

    def size(self):
        size = 0
        for callbackSet in self.callbackSets:
            size += len(callbackSet)
        return size

    def empty(self):
        return (self.size() == 0)