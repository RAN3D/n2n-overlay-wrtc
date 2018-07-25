const assert = require('assert')
const N2N = require('../lib/n2n-overlay.js')
const wrtc = require('wrtc')

describe('Tests for connection method', function () {
  this.timeout(4000)
  it('[connection] Connection successfully established', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    return p1.connection(p2).then((peer) => {
      console.log('[%s] Connected to [%s] ', p1.getOutviewId(), peer)
      assert.equal(peer, p2.getInviewId())
      p1.disconnect()
    }).catch(e => {
      p1.disconnect()
    })
  })
  it('[connection] Connection successfully timed out', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 0, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    return p1.connection(p2).catch(e => {
      console.log(e)
      assert.equal(e.message, 'timeout exceeded.')
      p1.disconnect()
    })
  })
})
