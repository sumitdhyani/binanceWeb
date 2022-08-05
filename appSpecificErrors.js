module.exports = {
    DuplicateSubscription : class DuplicateSubscription extends Error{
        constructor(message = "Duplicate subscription received"){
            super(message)
            this.name = "DuplicateSubscription"
        }
    },

    SpuriousUnsubscription : class SpuriousUnsubscription extends Error{
        constructor(message = "Unsubscription on a non-existent subscription"){
            super(message)
            this.name = "SpuriousUnsubscription"
        }
    },

    InvalidSymbol : class InvalidSymbol extends Error{
        constructor(message = "Invalid symbol"){
            super(message)
            this.name = "InvalidSymbol"
        }
    }
}