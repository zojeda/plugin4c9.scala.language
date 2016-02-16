var Swank = require('./swank-protocol');
import net = require('net');


let log = (args: any) => {
	console.log(args)
}


class Client {
	ensimeMessageCounter = 1
  callbackMap = {}
	parser: any
	socket: net.Socket


  constructor(port: number, private httpPort, generalMsgHandler, private serverPid = undefined) {

    this.parser = new Swank.SwankParser( (env) => {
      log("incoming: #{env}")
      let json = JSON.parse(env)
      let callId = json.callId;
      //If RpcResponse - lookup in map, otherwise use some general function for handling general msgs

      if(callId) {
        try {
          this.callbackMap[callId](json.payload)
        } catch (error) {
          log("error in callback: #{error}")
				} finally {
					delete this.callbackMap[callId]
				}
          
				
			}
      else
        generalMsgHandler(json.payload)
			
		});

    this.openSocket(port);
	}

  // # Kills server if it was spawned from here.
  // destroy: ->
  //   this.socket.destroy()
  //   @serverPid?.kill()

  openSocket(port) {
    console.log('connecting on port: ' + port)
    this.socket = net.connect({port: port, allowHalfOpen: true} , () =>
      console.log('client connected')
    )

    this.socket.on('data', (data) =>
      this.parser.execute(data)
    )

    this.socket.on('end', () =>
      console.log("Ensime server disconnected")
    )

    this.socket.on('close', (data) =>
      console.log("Ensime server close event: " + data)
    )

    this.socket.on('error', (data) => {
      if (data.code == 'ECONNREFUSED')
        log("Connection refused connecting to ensime, it is probably not running. Remove .ensime_cache/port and .ensime_cache/http and try again.")
      else if (data.code == 'EADDRNOTAVAIL')
        console.log(data)
        //# happens when connecting too soon I think
      else
        console.log("Ensime server error event: " + data)
		})

			
	}


  post(msg, callback) {
		this.postString(JSON.stringify(msg), callback)
	}
    


  goToTypeAtPoint(textBuffer, bufferPosition) {
    let offset = textBuffer.characterIndexForPosition(bufferPosition)
    let file = textBuffer.getPath()

    let req = {
      typehint: "SymbolAtPointReq",
      file: file,
      point: offset
			
		}

    this.post(req, (msg) => {
      let pos = msg.declPos
      //# Sometimes no pos
      if(pos)
        console.log('goToPosition(%d)', pos)
      else
        console.log("No declPos in response from Ensime server, cannot go anywhere :(")
		})
	}
	
  private postString(msg, callback) {
    let swankMsg = Swank.buildMessage(`"{"req": ${msg}, "callId": ${this.ensimeMessageCounter}}`)
    this.callbackMap[this.ensimeMessageCounter++] = callback
    log("outgoing: " + swankMsg)
    this.socket.write(swankMsg, "UTF8")
	}

}