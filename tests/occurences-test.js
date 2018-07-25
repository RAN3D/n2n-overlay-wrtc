const assert = require('assert')
const N2N = require('../lib/n2n-overlay.js')
const wrtc = require('wrtc')

describe('Tests for occurences through connection and disconnection methods', function () {
  this.timeout(4000)
  it('Occurences (3-peers network): 0|2; 1|0; 1|0', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p3 = new N2N({ peer: '3', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    const max = 2
    let current = 0
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
      current++
      if (current > max) throw new Error('the number of event open is higher than expected...')
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

  it('Occurences (2-peers network):  0|1; 1|0; => 0|2; 2|0;', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    const max = 2
    let current = 0
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
      current++
      if (current > max) throw new Error('the number of event open is higher than expected...')
    })
    return p1.connection(p2).then(() => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log(p1.neighbours())
          console.log(p2.neighbours())
          p1.neighbours().outview.forEach(e => {
            assert.equal(e.counter, 1)
          })
          p2.neighbours().inview.forEach(e => {
            assert.equal(e.counter, 1)
          })
          p1.connectionFromThisToPeer('2-I').then(() => {
            console.log(p1.neighbours())
            console.log(p2.neighbours())
            p1.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 2)
            })
            p2.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 2)
            })
            p1.disconnect()
            resolve()
          }).catch(e => {
            p1.disconnect()
            reject(e)
          })
        }, 1000)
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })

  it('Occurences (2-peers network):  0|1; 1|0; => 1|1; 1|1;', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    const max = 2
    let current = 0
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
      current++
      if (current > max) throw new Error('the number of event open is higher than expected...')
    })
    return p1.connection(p2).then(() => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log(p1.neighbours())
          console.log(p2.neighbours())
          p1.neighbours().outview.forEach(e => {
            assert.equal(e.counter, 1)
          })
          p2.neighbours().inview.forEach(e => {
            assert.equal(e.counter, 1)
          })
          p1.connectionFromPeertoThis('2-I').then(() => {
            console.log(p1.neighbours())
            console.log(p2.neighbours())
            // inverse compared to the previous test
            p1.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p2.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            // test also that we have 1 for the inverse
            p1.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p2.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p1.disconnect()
            p2.disconnect()
            resolve()
          }).catch(e => {
            p1.disconnect()
            reject(e)
          })
        }, 1000)
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })

  it('Occurences (3-peers network):  BRIDGE(through connect): 0|1; 1|1; 1|0 => 1|1; 1|1; 1|1;', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p3 = new N2N({ peer: '3', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    const max = 2
    let current = 0
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
      current++
      if (current > max) throw new Error('the number of event open is higher than expected...')
    })
    return p1.connection(p2).then(() => {
      return p2.connection(p3).then(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            console.log(p1.neighbours())
            console.log(p2.neighbours())
            console.log(p3.neighbours())
            // test the outview
            p1.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p2.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p3.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 0)
            })
            // test the inview
            p1.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 0)
            })
            p2.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p3.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            // now do the bridge, use the .bridge method with id or use the connect method to choose for you
            p2.connect('3-I', '1-I').then(() => {
              setTimeout(() => {
                console.log(p1.neighbours())
                console.log(p2.neighbours())
                console.log(p3.neighbours())
                // test the outview
                p1.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p2.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p3.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                // test the inview
                p1.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p2.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p3.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p1.disconnect()
                p2.disconnect()
                resolve()
              }, 1000)
            }).catch(e => {
              reject(e)
            })
            resolve()
          }, 1000)
        })
      })
    }).catch(e => {
      p1.disconnect()
      return Promise.reject(e)
    })
  })
  it('Occurences (3-peers network):  BRIDGE(through bridge): 0|1; 1|1; 1|0 => 1|1; 1|1; 1|1;', function () {
    let p1 = new N2N({ peer: '1', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p2 = new N2N({ peer: '2', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    let p3 = new N2N({ peer: '3', timeout: 2000, pendingTimeout: 2000, config: {wrtc} })
    const max = 2
    let current = 0
    p1.on('open', (peer) => {
      console.log('%s connected to %s', p1.PEER, peer)
      current++
      if (current > max) throw new Error('the number of event open is higher than expected...')
    })
    return p1.connection(p2).then(() => {
      return p2.connection(p3).then(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            console.log(p1.neighbours())
            console.log(p2.neighbours())
            console.log(p3.neighbours())
            // test the outview
            p1.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p2.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p3.neighbours().outview.forEach(e => {
              assert.equal(e.counter, 0)
            })
            // test the inview
            p1.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 0)
            })
            p2.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            p3.neighbours().inview.forEach(e => {
              assert.equal(e.counter, 1)
            })
            // now do the bridge, use the .bridge method with id or use the connect method to choose for you
            p2.bridge('3-I', '1-I').then(() => {
              setTimeout(() => {
                console.log(p1.neighbours())
                console.log(p2.neighbours())
                console.log(p3.neighbours())
                // test the outview
                p1.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p2.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p3.neighbours().outview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                // test the inview
                p1.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p2.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p3.neighbours().inview.forEach(e => {
                  assert.equal(e.counter, 1)
                })
                p1.disconnect()
                p2.disconnect()
                resolve()
              }, 1000)
            }).catch(e => {
              reject(e)
            })
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
