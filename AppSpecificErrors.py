class DuplicateSubscription(Exception):
    def __init__(self, message = "Duplicate subscription received"):
        super.__init__(message)

class SpuriousUnsubscription(Exception):
        def __init__(message = "Unsubscription on a non-existent subscription"):
            super.__init__(message)
