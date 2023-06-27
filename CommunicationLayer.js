
function listen(port, connectionEvtCallback) {
    const express = require('express')
    const app = express()
    const Socket_io = require('socket.io')
    const httpServer = httpHandle.createServer(app)
    const io = new Socket_io.Server(httpServer, {cors: {origin: "*"}})
    httpServer.listen(listenPort, () => {})

    io.on('connection', socket => {
        const connectionHandle = {
            send : (evt, data) => {
                socket.volatile.emit(evt, data)
            },

            subscribe : subscriptionDictionary=>
                Object.entries(subscriptionDictionary).forEach(([evt, callback])=> {
                    socket.on(evt, (...args)=> {
                    callback(socket, ...args)
                })
            })
        }

        connectionEvtCallback(connectionHandle)
    })
}

module.exports.listen=listen