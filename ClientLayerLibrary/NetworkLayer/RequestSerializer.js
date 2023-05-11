    class RequestSerializer{
        constructor(){
            this.queue = []
            this.waitingAck = false
        }

        requestToSend(sock, event, ack, ...data) {
            if (!this.waitingAck){
                this.send(sock, event, ack, ...data)
            } else{
                this.queue.push(()=>this.send(sock, event, ack, ...data))
            }
        }

        send(sock, event, ack, ...data) {
            sock.emit(event, ...data, (result)=>{
                ack(result)
                if (0 < this.queue.length) {
                    const nextExec = this.queue[0]
                    this.queue.shift()
                    nextExec()
                } else {
                    this.waitingAck = false
                }
            })

            this.waitingAck = true
        }
    }

    module.exports.RequestSerializer = RequestSerializer