const assert = require('assert')
const N2N = require('../lib/n2n-overlay.js')
const wrtc = require('wrtc')

describe('Tests for i/o Map with peer/age to see if age is equal to counter (neighborhood)', function () {
  this.timeout(4000)
  it('i ages have to be equal to counter of neighborhood', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    return p1.connection(p2).then((peer) => {
      return p1.connection(p2).then((peer) => {
        // console.log('[%s] Connected to [%s] ', p1.getOutviewId(), peer)
        return new Promise((resolve, reject) => {
          assert.equal(p1.neighbours().outview.length, p1.o.size) // size have to be the same
          p1.neighbours().outview.forEach((obj, peer) => {
            // console.log('Outview: ', obj.peer, obj.counter, peer, p1.o.has(obj.peer))
            assert(p1.o.has(obj.peer))
            assert.equal(p1.o.get(obj.peer), obj.counter)
          })
          setTimeout(() => {
            p2.neighbours().inview.forEach((obj, peer) => {
              // console.log('Inview: ', obj.peer, obj.counter, peer, p2.i.has(obj.peer))
              assert(p2.i.has(obj.peer))
              assert.equal(p2.i.get(obj.peer), obj.counter)
            })
            p1.disconnect()
            resolve()
          }, 2000)
        })
      })
    }).catch(e => {
      p1.disconnect()
    })
  })
})
