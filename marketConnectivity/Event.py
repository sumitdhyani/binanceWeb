import inspect

class Event:
    def __init__(self):
        self.callbacks0 = []
        self.callbacks1 = []
        self.callbacks2 = []
        self.callbacks3 = []

    def __iadd__(self, function):
        argList = inspect.getfullargspec(function)[0]
        numArgs = len(argList)
        if 0 < numArgs and 'self' == argList[0]:
            numArgs -= 1

        if 0 == numArgs:
            self.callbacks0.append(function)
        elif 1 == numArgs:
            self.callbacks1.append(function)
        elif 2 == numArgs:
            self.callbacks2.append(function)
        elif 3 == numArgs:
            self.callbacks3.append(function)

        return self

    def __isub__(self, function):
        try:
            self.callbacks0.remove(function)
            return self
        except:
            pass

        try:
            self.callbacks1.remove(function)
            return self
        except:
            pass

        try:
            self.callbacks2.remove(function)
            return self
        except:
            pass

        try:
            self.callbacks3.remove(function)
            return self
        except:
            raise Exception("Function is not a member of observer list")

    def __call__(self, *args, **kwargs):
        numArgs = len(args)
        callbackList = []
        if 0 == numArgs:
            callbackList = self.callbacks0
        elif 1 == numArgs:
            callbackList = self.callbacks1
        elif 2 == numArgs:
            callbackList = self.callbacks2
        elif 3 == numArgs:
            callbackList = self.callbacks3

        for callback in callbackList:
            callback(*args)

    def size(self):
        return len(self.callbacks0) + len(self.callbacks1) + len(self.callbacks2) + len(self.callbacks3)

    def empty(self):
        return (self.size() == 0)

def func0():
    print(0)

def func1(arg1):
    print(arg1)

def func2(arg1, arg2):
    print(arg1, arg2)

def func3(arg1, arg2, arg3):
    print(arg1, arg2, arg3)

##test code
calee = Event()
calee += func0
calee += func1
calee += func2
calee += func3

calee()
calee(1)
calee(1,2)
calee(1,2,3)