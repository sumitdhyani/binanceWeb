// Tier configuration — adjust limits here without touching any other code
// All subscription limits are per-connection concurrent maximums

const tiers = {
    anonymous: {
        depth:          5,
        trade:          2,
        virtual:        1,
        basket:         0,     // view-only (pre-built demo), no custom baskets
        sessionTTL:     1800,  // 30 minutes in seconds
    },
    free: {
        depth:          20,
        trade:          10,
        virtual:        5,
        basket:         2,
        sessionTTL:     86400, // 24 hours
    },
    paid: {
        depth:          Infinity,
        trade:          Infinity,
        virtual:        Infinity,
        basket:         Infinity,
        sessionTTL:     86400,
    }
}

function getLimits(tier) {
    return tiers[tier] || tiers.anonymous
}

module.exports = { tiers, getLimits }
