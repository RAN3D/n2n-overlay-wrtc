const NO = require('n2n-overlay-wrtc')
localStorage.debug = 'n2n-overlay-wrtc' // eslint-disable-line
// # create 3 peers+protocols
const opts1 = { pid: '1', peer: '1', config: {trickle: true} }
const n1 = new NO(opts1)
const opts2 = { pid: '1', peer: '2', config: {trickle: true} }
const n2 = new NO(opts2)
const opts3 = { pid: '1', peer: '3', config: {trickle: true} }
const n3 = new NO(opts3)

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

// #1 establishing a connection from n1 to n2
n1.connect(callback(n1, n2))
// #2 establishing a connection from n1 to n3
n1.connect(callback(n1, n3))
// // > console: should see 4 "connection established" messages
neighbours()

setTimeout(() => {
  sendMedia(n1, n2.getInviewId())
  sendMedia(n2, n1.getInviewId())
  n1.getOutview().forEach((occ, o1) => {
    n1.getOutview().forEach((occ2, o2) => {
      o1 !== o2 && console.log('%s --> %s', o1, o2)
      o1 !== o2 && n1.connect(o1, o2)
      neighbours()
    })
  })
}, 2000)

setTimeout(() => {
  n1.connect(null, n2.II.peer)
  neighbours()
}, 4000)

function neighbours () {
  console.log(n1.neighbours(), n2.neighbours(), n3.neighbours())
  console.log(n1.uniqNeighbours(), n2.uniqNeighbours(), n3.uniqNeighbours())
  console.log(n1.uniqNeighbours(true), n2.uniqNeighbours(true), n3.uniqNeighbours(true))
}

function sendMedia (fromProtocol, toId) {
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
