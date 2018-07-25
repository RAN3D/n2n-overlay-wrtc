const assert = require('assert')
const N2N = require('../lib/n2n-overlay.js')
const wrtc = require('wrtc')

describe('Tests for occurences through connection and disconnection methods', function () {
  this.timeout(4000)
  it('Occurences with connection should be 1 everywhere', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p3 = new N2N({ peer: '3', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
    })
    return p1.connection(p2).then(() => {
      return p1.connection(p3).then(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            p1.neighbours().inview.forEach(e => {
              console.log('p1 %s inview: %f', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            p1.neighbours().outview.forEach(e => {
              console.log('p1 %s outview: %i', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            assert.equal(p1.neighbours().inview.length, 0)
            assert.equal(p1.neighbours().outview.length, 2)
            p2.neighbours().inview.forEach(e => {
              console.log('p2 %s inview: %f', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            p2.neighbours().outview.forEach(e => {
              console.log('p2 %s outview: %f', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            assert.equal(p2.neighbours().inview.length, 1)
            assert.equal(p2.neighbours().outview.length, 0)
            p3.neighbours().inview.forEach(e => {
              console.log('p3 %s inview: %f', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            p3.neighbours().outview.forEach(e => {
              console.log('p3 %s outview: %f', e.peer, e.counter)
              assert.equal(e.counter, 1)
            })
            assert.equal(p3.neighbours().inview.length, 1)
            assert.equal(p3.neighbours().outview.length, 0)
            p1.disconnect()
            resolve()
          }, 1000)
        })
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })
})
