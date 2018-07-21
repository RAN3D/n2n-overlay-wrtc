'use strict'

const debug = (require('debug'))('n2n-overlay-wrtc')
const Neighborhood = require('neighborhood-wrtc')
const EventEmitter = require('events')
const merge = require('lodash.merge')
const uuid = require('uuid/v4')

const MForwardTo = require('./messages/mforwardto.js')
const MForwarded = require('./messages/mforwarded.js')
const MConnectTo = require('./messages/mconnectto.js')
const MDirect = require('./messages/mdirect.js')

/**
 * A peer has an inview and an outview, i.e., tables containing sockets to
 * communicate with remote peers. This module transforms a peer so it can act as
 * a bridge between its direct neighbors. Consequently, these neighbors can
 * create their own communication channels: necessary data to establish the
 * connection travel through the bridge; once the connection is successfully
 * established, they communicate using their own direct connection.
 */
class N2N extends EventEmitter {
  /**
     * @param {object} [options] options represented as an object (refer to
     * neighborhood-wrtc for other options).
     * @param {string} [options.pid] The unique identifier of the protocol.
     * @param {number} [options.retry = 5] The number of times it tries to send
     * a message.
     * @param {Neighborhood} [options.inview] The neighborhood used for inviews,
     * i.e., incoming arcs.
     * @param {Neighborhood} [options.outview] The neigbhorhood used for
     * outviews, i.e., outgoing arcs.
     */
  constructor (options = {}) {
    super()
    // #0 process the options
    /**
     * @public
     * @type {Object} Options
     */
    this.options = merge({ pid: uuid(),
      peer: uuid(),
      retry: 5 }, options)
    /**
     * @private
     * @type {EventEmitter}
     */
    this._bus = new EventEmitter()
    // #1 initialize unmutable protocolId
    /**
     * name of the protocol
     * @type {String}
     */
    this.PID = this.options.pid
    // #2 initialize the neighborhoods /!\ i.peer and o.peer must be ≠
    /**
     * @private
     * Neighborhood class corresponding to inview arcs
     * @type {Neighborhood}
     */
    this.NI = this.options.inview ||
            new Neighborhood(merge(merge({}, this.options),
        {peer: this.options.peer + '-I'}))
    /**
     * @private
     * Neighborhood class corresponding to outview arcs
     * @type {Neighborhood}
     */
    this.NO = this.options.outview ||
            new Neighborhood(merge(merge({}, this.options),
        {peer: this.options.peer + '-O'}))
    // #3 initialize the interfaces
    /**
     * @private
     */
    this.II = this.NI.register(this)
    /**
     * @private
     */
    this.IO = this.NO.register(this)
    /**
     * The peer ID containing both inview and outview ID
     * @type {String}
     */
    this.PEER = this.II.peer + '|' + this.IO.peer
    debug('[%s] registered to ==> %s ==>', this.PID, this.PEER)
    // #4 intialize the tables
    /**
     * @private
     * @type {Map}
     */
    this.i = new Map()
    /**
     * @private
     * @type {Map}
     */
    this.o = new Map()
  }

  /**
     * @private The getter of the identifier of this protocol.
     * @returns {string} The identifier of this protocol.
     */
  _pid () {
    return this.PID
  }

  /**
     * @private Behavior when this protocol receives a message from peerId.
     * @param {string} peerId The identifier of the peer that we received a
     * message from.
     * @param {object} message The message received.
     */
  _received (peerId, message) {
    if (message.type) {
      if (message.type === 'MConnectTo' ||
                message.type === 'MForwarded' ||
                message.type === 'MForwardTo' ||
                message.type === 'MBridge-status') {
        this._bridge(peerId, message)
      } else if (message.type === 'MResponse' ||
                      message.type === 'MRequest' ||
                      message.type === 'MDirect' ||
                      message.type === 'MDirect-status') {
        this._direct(peerId, message)
      } else {
        this.emit('receive', peerId, message)
      }
    } else {
      this.emit('receive', peerId, message)
    }
  }

  /**
     * @private Behavior when this protocol receives a stream from peerId.
     * @param {string} peerId The identifier of the peer that we received a
     * message from.
     * @param {object} stream The stream received.
     */
  _streamed (peerId, stream) {
    this.emit('stream', peerId, stream)
  }

  /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer reachable through the
     * newly added arc.
     * @param {boolean} isOutgoing State if the added arc is outgoing or not.
     */
  _connected (peerId, isOutgoing) {
    if (isOutgoing) {
      if (!this.o.has(peerId)) {
        this.o.set(peerId, 0)
      }
      this.o.set(peerId, this.o.get(peerId) + 1)
      this.emit('open', peerId) // only consider outgoing arcs
    } else {
      if (!this.i.has(peerId)) {
        this.i.set(peerId, 0)
      }
      this.i.set(peerId, this.i.get(peerId) + 1)
    }
  }

  /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer that removed an arc.
     */
  _disconnected (peerId) {
    if (this.o.has(peerId)) {
      this.o.set(peerId, this.o.get(peerId) - 1)
      if (this.o.get(peerId) <= 0) this.o.delete(peerId)
      this.emit('close', peerId) // only outview
    } else if (this.i.has(peerId)) {
      this.i.set(peerId, this.i.get(peerId) - 1)
      if (this.i.get(peerId) <= 0) this.i.delete(peerId)
    }
  }

  /**
     * @private Notify failure
     * @param {string} peerId The identifier of the peer we failed to establish
     * a connection with.
     * @param {boolean} isOutgoing State whether or not the failed arc was
     * supposed to be an outgoing arc.
     */
  _failed (peerId, isOutgoing) {
    // only takes into account the outgoing arcs
    isOutgoing && this.emit('fail', peerId)
  }

  /**
     * @private Function that execute to bridge a connection establishement
     * between two peers: we start from (i -> b -> a) to get (i -> b -> a) and
     * (i -> a).
     * @param {string} peerId The identifier of the peer that sent us the
     * message
     * @param {MConnectTo|MForwardTo|MForwarded} msg The message received.
     */
  _bridge (peerId, msg) {
    if (msg.type && msg.type === 'MConnectTo') {
      // #1 we are the initiator
      this.IO.connect((req) => {
        this.send(peerId, new MForwardTo(msg.from, msg.to, req, msg.jobId),
          this.options.retry)
          .catch((e) => {
            // send ACK that the connection do not succeed
            this.send(peerId, {
              type: 'MBridge-status',
              status: false,
              reason: e,
              jobId: msg.jobId
            }).catch(e => {
              // need a proper way to dispatch the ACK
              console.error('Cant send an ACK to ' + peerId, e)
            })
          }) // nothing on catch
      }).then((peer) => {
        // send ACK that the connection succeeded
        this.send(peerId, {
          type: 'MBridge-status',
          status: true,
          reason: null,
          jobId: msg.jobId
        }).catch(e => {
          // need a proper way to dispatch the ACK
          console.error('Cant send an ACK to ' + peerId, e)
        })
      }).catch(e => {
        // send ACK that the connection do not succeed
        this.send(peerId, {
          type: 'MBridge-status',
          status: false,
          reason: e,
          jobId: msg.jobId
        }).catch(e => {
          // need a proper way to dispatch the ACK
          console.error('Cant send an ACK to ' + peerId, e)
        })
      })
    } else if (msg.type && msg.type === 'MForwardTo') {
      // #2 we are the bridge
      this.send(msg.to, new MForwarded(msg.from, msg.to, msg.message, msg.jobId),
        this.options.retry)
        .catch((e) => {
          this.emit(msg.jobId, {
            type: 'MBridge-status',
            status: false,
            reason: e,
            jobId: msg.jobId
          })
        }) // nothing on catch
    } else if (msg.type && msg.type === 'MForwarded' &&
                   msg.message.type === 'MRequest') {
      // #3 we are the acceptor
      this.II.connect((res) => {
        this.send(peerId, new MForwardTo(msg.to, msg.from, res, msg.jobId),
          this.options.retry)
          .catch((e) => {
            this.send(peerId, {
              type: 'MBridge-status',
              status: false,
              reason: e,
              jobId: msg.jobId
            }).catch(e => {
              // need a proper way to dispatch the ACK
              console.error('Cant send an ACK to ' + peerId, e)
            })
          }) // nothing on catch
      }, msg.message)
      // #4 reapplies #2
    } else if (msg.type && msg.type === 'MForwarded' &&
                   msg.message.type === 'MResponse') {
      // #5 we are the finalizor
      this.IO.connect(msg.message)
    } else if (msg.type === 'MBridge-status') {
      this._bus.emit(msg.jobId, msg)
    }
  }

  /**
     * @private Create a connection with a neighbor: from (i -> a) we obtain
     * either (i <-> a) or (i => a). In the former case, assuming that Peer a
     * does not already have a connection to Peer i, it must create a WebRTC
     * connection to a. In the latter case, Peer i only duplicates its arc to
     * Peer a. Thus, it must disconnect twice to truly destroy the connection.
     * @param {string} peerId The identifier of the peer that we received a
     * message from.
     * @param {string} message The received message.
     */
  _direct (peerId, message) {
    debug('direct, %s ', peerId, message)
    if (message.type === 'MDirect') {
      this.IO.connect((req) => {
        this.send(peerId, req, this.options.retry).catch((e) => { })
      }).then((peer) => {
        this.send(peerId, {
          type: 'MDirect-status',
          jobId: message.jobId,
          status: true,
          reason: null
        }, this.options.retry).catch((e) => {
          console.error('Please report. (_direct MDirect)')
        })
      }).catch(e => {
        this.send(peerId, {
          type: 'MDirect-status',
          jobId: message.jobId,
          status: false,
          reason: e
        }, this.options.retry).catch((e) => {
          console.error('Please report. (_direct MDirect)')
        })
      })
    } else if (message.type === 'MRequest') {
      this.II.connect((res) => {
        this.send(peerId, res, this.options.retry).catch((e) => { })
      }, message)
    } else if (message.type === 'MResponse') {
      this.IO.connect(message)
    } else if (message.type === 'MDirect-status') {
      this._bus.emit(message.jobId, message)
    }
  }

  /**
     * Send a message using either the inview or the outview.
     * @param {string} peerId The identifier of the receiver.
     * @param {object} message The message to send.
     * @param {number} [retry = 0] Number of times it retries to send a
     * message.
     * @return {promise} Promise that resolves if the message is sent, reject
     * otherwise.
     */
  send (peerId, message, retry = 0) {
    let promise
    // #1 normal behavior
    if (this.i.has(peerId)) {
      promise = this.II.send(peerId, message, retry)
    } else if (this.o.has(peerId)) {
      promise = this.IO.send(peerId, message, retry)
    } else {
      // determine if it is an inview id or an outview arc and in case of inview, tranform it to outview and try to find it in the outview, reverse method for outview id
      const root = peerId.substr(0, peerId.length - 2)
      const inv = root + '-I'
      const out = root + '-O'
      if (this.o.has(inv)) {
        promise = this.IO.send(inv, message, retry)
      } else if (this.i.has(out)) {
        promise = this.II.send(out, message, retry)
      } else {
        // #2 last chance behavior
        promise = new Promise((resolve, reject) => {
          const _send = (r) => {
            this.IO.send(peerId, message, 0)
              .then(() => resolve())
              .catch((e) => this.II.send(peerId, message, 0)
                .then(() => resolve())
                .catch((e) => {
                  if (r < retry) {
                    setTimeout(() => {
                      _send(r + 1)
                    }, 1000)
                  } else {
                    reject(e)
                  }
                }))
          }
          _send(0)
        })
      }
    }
    return promise
  }

  /**
     * Send a MediaStream using either the inview or the outview.
     * @param {string} peerId The identifier of the receiver.
     * @param {MediaStream} media The message to send.
     * @param {number} [retry = 0] Number of times it retries to send a
     * message.
     * @return {promise} Promise that resolves if the message is sent, reject
     * otherwise.
     */
  stream (peerId, media, retry = 0) {
    let promise
    // #1 normal behavior
    if (this.i.has(peerId)) {
      promise = this.II.stream(peerId, media, retry)
    } else if (this.o.has(peerId)) {
      promise = this.IO.stream(peerId, media, retry)
    } else {
      // determine if it is an inview id or an outview arc and in case of inview, tranform it to outview and try to find it in the outview, reverse method for outview id
      const root = peerId.substr(0, peerId.length - 2)
      const inv = root + '-I'
      const out = root + '-O'
      if (this.o.has(inv)) {
        promise = this.IO.stream(inv, media, retry)
      } else if (this.i.has(out)) {
        promise = this.II.stream(out, media, retry)
      } else {
        // #2 last chance behavior
        promise = new Promise((resolve, reject) => {
          const _send = (r) => {
            this.IO.stream(peerId, media, 0)
              .then(() => resolve())
              .catch((e) => this.II.send(peerId, media, 0)
                .then(() => resolve())
                .catch((e) => {
                  if (r < retry) {
                    setTimeout(() => {
                      _send(r + 1)
                    }, 1000)
                  } else {
                    reject(e)
                  }
                }))
          }
          _send(0)
        })
      }
    }
    return promise
  }

  /**
   * Connect a peer to its other N2N peer directly or use a signaling service to connect them.
   * @example
   * const opts1 = { pid: '1', pendingTimeout: 2000, peer: '1', config: {trickle: true} }
   * const n1 = new NO(opts1)
   * const opts2 = { pid: '1', pendingTimeout: 2000, peer: '2', config: {trickle: true} }
   * const n2 = new NO(opts2)
   * // using the a direct callback
   * n1.connection(n2).then((peer) => { console.log('%s is connected to %s', n1.II.peer, n2.II.peer)})
   * // using a signaling service
   * n1.connection(null, (initOffer, finalizeCallback) => {
   *  // SIMULATE a signaling service
   *  // (This is the responsability of n1 to find a way to send the offer to n3, and n3 to accept the offer)
   *  n2.acceptOffer(initOffer).then((acceptedOffer) => {
   *    // (This is the responsability of n3 to find a way to send the accepted offer to n1, and n1 to finalize the connection)
   *    finalizeCallback(acceptedOffer)
   *  }).catch(e => {
   *    console.error(e)
   *   })
   * }).then(() => {
   *  console.log('n1 is connected to n3 through a signaling service')
   * })
   * @param  {N2N} dest              Another N2N instance to connect with
   * @param  {callback} initOfferCallback Or a signaling callback which will have an initOffer and the finalize method to call when you will receive an accepted offer (initOffer, done) => {this is your responsability to send the initOffer, accept the init offer somewhere and to call the done method }
   * @return {Promise} Return a promise which will resolve when the connection is done, otherwise reject an error.
   */
  connection (dest, initOfferCallback) {
    return new Promise((resolve, reject) => {
      if (dest) {
        // use a direct callback because the client want to direclty connect to the peer
        this.IO.connect((initOffer) => {
          return this._defaultCallback(this, dest)(initOffer)
        }).then((peer) => {
          resolve(peer)
        }).catch(e => {
          reject(e)
        })
      } else {
        this.IO.connect((initOffer) => {
          debug('init signaling offer: ', initOffer)
          initOfferCallback(initOffer, (offer) => {
            debug('finalize signaling offer: ', initOffer)
            return this._onReceiveAcceptedOffer(offer)
          })
        }).then((peer) => {
          resolve(peer)
        }).catch(e => {
          reject(e)
        })
      }
    })
  }

  /**
   * Connection between us and a remote peer that is ALREADY CONNECTED. It add an arc to the connection.
   * So if you want to delete this connection you need to call twice n1.disconnect(n2.getOutviewId())
   * The connection will be: us -> peer
   * @param  {String}  peerId peerId to connectWith
   * @return {Promise} Resolve when the connection succesfully established
   * @example
   * const opts1 = { pid: '1', pendingTimeout: 2000, peer: '1', config: {trickle: true} }
   * const n1 = new NO(opts1)
   * const opts2 = { pid: '1', pendingTimeout: 2000, peer: '2', config: {trickle: true} }
   * const n2 = new NO(opts2)
   * // using the a direct callback
   * n1.connection(n2).then((peer) => {
   *  console.log('%s is connected to %s', n1.II.peer, n2.II.peer)
   *  n1.connectionFromThisToPeer(n2.getOutviewId()).then((peer) => { console.log('%s is connected to %s', n1.II.peer, n2.II.peer)})
   * })
   */
  connectionFromThisToPeer (peerId) {
    return new Promise((resolve, reject) => {
      this.IO.connect((req) => {
        // send the offer to peerId
        this.send(peerId, req, this.options.retry).catch((e) => { reject(e) })
      }).then((peer) => {
        resolve(peer)
      }).catch(e => {
        reject(e)
      })
    })
  }
  /**
   * Connection between us and a remote peer that is ALREADY CONNECTED. It add an arc to the connection from the peer to us
   * So if you want to delete this connection you need to call twice n1.disconnect(n2.getOutviewId())
   * The connection will be: peer -> us
   * @param  {String}  peerId peerId to connectWith
   * @return {Promise} Resolve when the connection succesfully established
   * @example
   * const opts1 = { pid: '1', pendingTimeout: 2000, peer: '1', config: {trickle: true} }
   * const n1 = new NO(opts1)
   * const opts2 = { pid: '1', pendingTimeout: 2000, peer: '2', config: {trickle: true} }
   * const n2 = new NO(opts2)
   * // using the a direct callback
   * n1.connection(n2).then((peer) => {
   *  console.log('%s is connected to %s', n1.II.peer, n2.II.peer)
   *  n1.connectionFromPeertoThis(n2.getOutviewId()).then((peer) => { console.log('%s is connected to %s', n2.II.peer, n1.II.peer)})
   * })
   */
  connectionFromPeertoThis (peerId) {
    return new Promise((resolve, reject) => {
      const id = uuid()
      const m = new MDirect()
      m.jobId = id
      this.send(peerId, m, this.options.retry).catch((e) => { reject(e) }).then(() => {
        this._bus.once(id, (message) => {
          debug('connectionFromPeertoThis: ', message)
          if (message.status === true) {
            resolve()
          } else {
            reject(new Error('the connection between the peer and us has failed' + message.reason))
          }
        })
      })
    })
  }

  /**
   * @private
   * Default direct callback
   * @param  {N2N} from The N2N initiator, usually us.
   * @param  {N2N} to A N2N class to connect with
   * @return {function}      return a callback with an offer as parameter
   */
  _defaultCallback (from, to) {
    return (offer) => {
      debug('init direct offer: ', offer)
      to.acceptOffer(offer).then((acceptedOffer) => {
        debug('accepted direct offer: ', acceptedOffer)
        from._onReceiveAcceptedOffer(acceptedOffer)
      })
    }
  }

  /**
   * Accept an initialized offer. Call this method only when you are using a custom signaling service.
   * @param  {Object} offer The offer to accept
   * @return {[type]}       [description]
   */
  acceptOffer (offer) {
    return new Promise((resolve, reject) => {
      this.II.connect((answer) => {
        debug('accept signaling offer: ', answer)
        resolve(answer)
      }, offer)
    })
  }

  /**
   * @private
   * Callback to call when you receive an accepted offer
   * @param  {Object} offer the accepted offer received for finalizing the connection
   * @return {void}
   */
  _onReceiveAcceptedOffer (offer) {
    this.IO.connect(offer)
  }

  /**
   * Connect 2 neighbours using existing connections instead of a signling service.
   * Warning: the connection could be finished and you might not receive the ACK message from the initiator.
   * Because the connection you and the initiator was down after the establishement of the connection between from and to.
   * @param  {String} from The id of the remote peer that will initiate the connection
   * @param  {String} to   the id of the remote peer that will be conencted with the "from" peer
   * @return {Promise} Resolve when the bridge is finished. Reject if an error appear during the bridge. Do not reject you dont receive the ACK from the initiator.
   * @example
   * const opts1 = { pid: '1', pendingTimeout: 2000, peer: '1', config: {trickle: true} }
   * const n1 = new NO(opts1)
   * const opts2 = { pid: '1', pendingTimeout: 2000, peer: '2', config: {trickle: true} }
   * const n2 = new NO(opts2)
   * const opts2 = { pid: '1', pendingTimeout: 2000, peer: '3', config: {trickle: true} }
   * const n2 = new NO(opts2)
   * // using the a direct callback
   * n1.connection(n2).then((peer) => {
   *  n1.connection(n3).then((peer) => {
   *    n1.brodge(n2.getOutviewId(), n3.getOutviewId()).then(() => {
   *      console.log('Connection established between n2 and n3 through n1')
   *    })
   *  })
   * })
   */
  bridge (from, to) {
    return new Promise((resolve, reject) => {
      debug('[%s] %s =π= %s =π> %s', this.PID, from, this.PEER, to)
      const id = uuid()
      this.send(from, new MConnectTo(from, to, id),
        this.options.retry).catch((e) => { reject(e) })
      this._bus.once(id, (message) => {
        if (message.status === true) {
          resolve()
        } else {
          reject(new Error(message.reason))
        }
      })
    })
  }

  /**
   * @deprecated Use either: connection, connectionFromPeertoThis, connectionFromThisToPeer or bridge
   * Create an arc (establishes a WebRTC connection if need be) from 'from' to
   * 'to'. (TODO) explain function args
   * @param {function|MResponse|string|null} from - The identifier of the peer
   * that must initiate the connection. Null implicitely means this.
   * @param {MRequest|string|null} to - The identifier of the peer that must
   * accept the connection. Null implicitely means this.
   */
  connect (from = null, to = null) {
    console.warn('[WARNING] deprecated method. Use either: connection, connectionFromPeertoThis, connectionFromThisToPeer or bridge')
    if (typeof from === 'function' && to === null) {
      debug('%s Connect: from=function, to===null', this.IO.peer)
      return this.IO.connect((req) => from(req))
    } else if (typeof from === 'function' && to !== null) {
      debug('%s Connect: from === function && to !== null', this.II.peer)
      // debug('[%s] %s <π= ??? =π= %s', this.PID, this.getInviewId(), to.peer)
      this.II.connect((res) => from(res), to).catch(e => { console.error(e) })
    } else if (from !== null && typeof from === 'object' && to === null) {
      debug('%s Connect: from!==null && object, to===null, means this is an offer', this.IO.peer)
      this.IO.connect(from).catch(e => { console.error(e) })
    } else {
      debug('%s handling n2n connection...', this.IO.peer)
      if (from !== null && (from === this.IO.peer || from === this.II.peer)) {
        from = null
      }
      if (to !== null && (to === this.IO.peer || to === this.II.peer)) {
        to = null
      }

      if (from !== null && to !== null) {
        return this.bridge(from, to)
      } else if (from !== null) {
        return this.connectionFromPeertoThis(from)
      } else if (to !== null) {
        return this.connectionFromThisToPeer(to)
      }
    }
  }

  /**
     * Remove an arc of the outview or all arcs
     * @param {string} peerId The identifier of the arc to remove.
     * @return {Promise} Resolve when either one/all arc(s) is/are disconnected.
     */
  disconnect (peerId) {
    if (typeof peerId === 'undefined') {
      return Promise.all([this.II.disconnect(), this.IO.disconnect()])
    } else {
      if (this.i.has(peerId)) return this.II.disconnect(peerId)
      if (this.o.has(peerId)) return this.IO.disconnect(peerId)
      return Promise.reject(new Error('peer not found'))
    }
  }

  /**
   * Return living neighbours as specified in neighborhood-wrtc
   * @return {[Object]} Object containing living inview and living outview entries
   */
  neighbours () {
    return {
      inview: this.II.neighbours(),
      outview: this.IO.neighbours()
    }
  }

  /**
   * Return an array of uniq reachable peers without distinction between inview or outview (without -I or -O)
   * if you want to send a message to one of these peers, add either a -I or a -I (or pass a boolean as parameter, default false)
   * @param {Boolean} [transform=false] If true, transform final Id into ids that can be used to send messages
   * @return {[type]} [description]
   */
  uniqNeighbours (transform = false) {
    const i = this.II.neighbours()
    const o = this.IO.neighbours()
    const peers = []
    i.forEach(entry => {
      const p = entry.peer.substr(0, entry.peer.length - 2)
      if (peers.indexOf(p) === -1) peers.push(p)
    })
    o.forEach(entry => {
      const p = entry.peer.substr(0, entry.peer.length - 2)
      if (peers.indexOf(p) === -1) peers.push(p)
    })
    if (transform) return peers.map(p => p + '-O')
    return peers
  }

  /**
     * Getter of the inview.
     * @returns {Map} A new map comprising {peerId => occurrences}.
     */
  getInview () {
    return new Map(this.i)
  }

  /**
     * Getter of the inview ID.
     * @returns {string} The identifier of the inview.
     */
  getInviewId () {
    return this.NI.PEER
  }

  /**
     * Getter of the outview.
     * @returns {Map} A new map comprising {peerId => occurrences}.
     */
  getOutview () {
    return new Map(this.o)
  }

  /**
     * Getter of the inview ID.
     * @returns {string} The identifier of the outview.
     */
  getOutviewId () {
    return this.NO.PEER
  }
}

module.exports = N2N
