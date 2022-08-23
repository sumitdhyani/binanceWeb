class DuplicateSubscription(Exception):
    def __init__(self, message = "Duplicate subscription received"):
        super().__init__(message)

class SpuriousUnsubscription(Exception):
    def __init__(self, message = "Unsubscription on a non-existent subscription"):
        super().__init__(message)

class InvalidCallbackFormat(Exception):
    def __init__(self, message = "Unexpected no. of params in registered callback"):
        super().__init__(message)

class InvalidEventInvokation(Exception):
    def __init__(self, message = "Unexpected no. of arguments in event invokation"):
        super().__init__(message)