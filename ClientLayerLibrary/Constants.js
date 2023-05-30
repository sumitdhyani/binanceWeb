const constants = {
    tags : {exchange : "exchange", action : "action"},
    exchanges: {exch_binance : "BINANCE"},
    instrumets : {currency_pair : "currency_pair",
                  bridged_currency_pair : "bridged_currency_pair"},
    fsm_events : { client_intent : "client_intent"},
    error_codes : {no_feed_server : "no_feed_server"},
    
    //GUI specific
    trie_indices : { symbol : "symbol"},
    widget_ids : {button : "button", 
                  editable_text_box : "editable_text_box",
                  editable_drop_down : "editable_drop_down",
                  tab : "tab"
                 }
}

module.exports.constants = constants