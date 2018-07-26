const assert = require('assert')
const N2N = require('../lib/n2n-overlay.js')
const wrtc = require('wrtc')

describe('Tests for connection method', function () {
  this.timeout(4000)
  it('Disconnection with parameter successfully done', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    return p1.connection(p2).then((peer) => {
      return new Promise((resolve, reject) => {
        p1.disconnect(peer).then(() => {
          assert.equal(p1.neighbours().inview.length, 0)
          assert.equal(p1.neighbours().outview.length, 0)
          assert.equal(p2.neighbours().inview.length, 0)
          assert.equal(p2.neighbours().outview.length, 0)
          resolve()
        }).catch(e => {
          reject(e)
        })
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })
  it('Disconnection without parameter successfully done', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p3 = new N2N({ peer: '3', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    return p1.connection(p2).then(() => {
      // console.log('p1 <=> p2', p1.neighbours().inview.length, p1.neighbours().outview.length)
      return p1.connection(p3).then(() => {
        // console.log('p1 <=> p3', p1.neighbours().inview.length, p1.neighbours().outview.length)
        return p1.disconnect().then(() => {
          // console.log('p1 <break> p2')
          // console.log('p1 <break> p3')
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              // wait 3000 seconds to get the disconnection on p2 on p3 because we have a 2000 ms timeout
              assert.equal(p1.neighbours().inview.length, 0)
              assert.equal(p1.neighbours().outview.length, 0)
              assert.equal(p2.neighbours().inview.length, 0)
              assert.equal(p2.neighbours().outview.length, 0)
              assert.equal(p3.neighbours().inview.length, 0)
              assert.equal(p3.neighbours().outview.length, 0)
            }, 3000)
            resolve()
          }).catch(e => {
            return Promise.reject(e)
          })
        })
      }).catch(e => {
        p1.disconnect()
        return Promise.reject(e)
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })
})
