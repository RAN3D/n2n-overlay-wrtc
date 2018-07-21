const NO = require('n2n-overlay-wrtc')
localStorage.debug = 'n2n-overlay-wrtc' // eslint-disable-line
// # create 3 peers+protocols
const opts1 = { pid: '1', timeout: 1000, pendingTimeout: 2000, peer: '1', config: {trickle: true} }
const n1 = new NO(opts1)
const opts2 = { pid: '1', timeout: 1000, pendingTimeout: 2000, peer: '2', config: {trickle: true} }
const n2 = new NO(opts2)
const opts3 = { pid: '1', timeout: 1000, pendingTimeout: 2000, peer: '3', config: {trickle: true} }
const n3 = new NO(opts3)

n1.on('close', (peer) => {
  console.log('[%s] A connection has just closed: %s', n1.PEER, peer)
})
n2.on('close', (peer) => {
  console.log('[%s] A connection has just closed: %s', n2.PEER, peer)
})
n3.on('close', (peer) => {
  console.log('[%s] A connection has just closed: %s', n3.PEER, peer)
})
n1.on('open', (peer) => {
  console.log('[%s]A connection has just opened: %s', n1.PEER, peer)
})
n2.on('open', (peer) => {
  console.log('[%s]A connection has just opened: %s', n2.PEER, peer)
})
n3.on('open', (peer) => {
  console.log('[%s]A connection has just opened: %s', n3.PEER, peer)
})

const callback = (from, to) => {
  return (offer) => {
    to.connect((answer) => { from.connect(answer) }, offer)
  }
}

n1.on('stream', (id, stream) => {
  console.log('Receive a stream from: %s', id, stream)
  const video = document.getElementById(n1.PEER + 'r')
  console.log(video)
  try {
    video.srcObject = stream
  } catch (error) {
    video.src = URL.createObjectURL(stream)
  }
  video.play() // show the receiver
})
n2.on('stream', (id, stream) => {
  console.log('Receive a stream from: %s', id, stream)
  const video = document.getElementById(n2.PEER + 'r')
  console.log(video)
  try {
    video.srcObject = stream
  } catch (error) {
    video.src = URL.createObjectURL(stream)
  }
  video.play() // show the receiver
})

function now () { // eslint-disable-line
  return new Promise((resolve, reject) => {
    n1.connection(n2).then((peer) => {
      console.log('* n1 is directly connected to n2')
      n1.connection(null, (initOffer, finalizeCallback) => {
        // SIMULATE a signaling service
        // (This is the responsability of n1 to find a way to send the offer to n3, and n3 to accept the offer)
        n3.acceptOffer(initOffer).then((acceptedOffer) => {
          // (This is the responsability of n3 to find a way to send the accepted offer to n1, and n1 to finalize the connection)
          finalizeCallback(acceptedOffer)
        }).catch(e => {
          reject(e)
        })
      }).then(() => {
        console.log('* n1 is connected to n3 through a signaling service')
        // behave()
        console.log('* New connection engaged from %s to %s', n1.getInviewId(), n2.getOutviewId())
        n1.connectionFromThisToPeer(n2.getOutviewId()).then(() => {
          console.log('* New connection established. from n1 to n2')
          n1.connectionFromPeertoThis(n2.getOutviewId()).then(() => {
            console.log('* New connection established. from n2 to n1')
            n1.bridge(n2.getOutviewId(), n3.getOutviewId()).then(() => {
              console.log('* bridge finished between n2 and n3.')
              resolve()
            }).catch(e => {
              reject(e)
            })
          }).catch(e => {
            reject(e)
          })
        }).catch(e => {
          reject(e)
        })
      }).catch(e => {
        reject(e)
      })
    }).catch(e => {
      reject(e)
    })
  })
}

function all () { // eslint-disable-line
  now().then(() => {
    behave()
  })
}

function old () { // eslint-disable-line
  // #1 establishing a connection from n1 to n2
  n1.connect(callback(n1, n2)).then((peer) => {
    console.log('* connected to ', peer)
    // #2 establishing a connection from n1 to n3
    n1.connect(callback(n1, n3)).then((peer) => {
      n1.connect(null, n2.getOutviewId())
      n1.connect(n2.getOutviewId(), null)
      console.log('* connected to ', peer)
      n1.connect(n2.II.peer, n3.II.peer)
    })
  })
}

function behave () { // eslint-disable-line
  neighbours()
  setTimeout(() => {
    sendMedia(n1, n2.getInviewId())
    sendMedia(n2, n1.getInviewId())
  }, 2000)
}

function neighbours () { // eslint-disable-line
  console.log(n1.neighbours(), n2.neighbours(), n3.neighbours())
  console.log(n1.uniqNeighbours(), n2.uniqNeighbours(), n3.uniqNeighbours())
  console.log(n1.uniqNeighbours(true), n2.uniqNeighbours(true), n3.uniqNeighbours(true))
}

function sendMedia (fromProtocol, toId) { // eslint-disable-line
  console.log('SEND MEDIA FROM %s TO %s', fromProtocol.PEER, toId)
  navigator.mediaDevices.getUserMedia({
    video: true
  }).then((mediaStream) => {
    const video = document.getElementById(fromProtocol.PEER)
    try {
      video.srcObject = mediaStream
    } catch (error) {
      video.src = URL.createObjectURL(mediaStream)
    }
    video.play() // show the receiver
    fromProtocol.stream(toId, mediaStream)
  }).catch(e => {
    console.error(e)
  })
}
