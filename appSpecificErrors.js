module.exports = [
    class DuplicateSubscription extends Error{
        constructor(){
            super("Duplicate subscription received")
            this.name = DuplicateSubscriptionError
        }

        constructor(message){
            super(message)
            this.name = "DuplicateSubscription"
        }
    },

    class SpuriousUnsubscription extends Error{
        constructor(){
            super("Unsubscription on a non-existent subscription")
            this.name = DuplicateSubscriptionError
        }

        constructor(message){
            super(message)
            this.name = "SpuriousUnsubscription"
        }
    },

    class InvalidSymbol extends Error{
        constructor(){
            super("Invalid symbol")
            this.name = DuplicateSubscriptionError
        }

        constructor(message){
            super(message)
            this.name = "InvalidSymbol"
        }
    }
]