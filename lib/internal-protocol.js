'use strict'

const Neighborhood = require('neighborhood-wrtc')

class InternalProtocol extends Neighborhood {
  constructor (parent, options) {
    super(options)
    this._options = options
    this._parent = parent
    /**
     * name of the protocol
     * @type {String}
     */
    this.PID = this._options.pid
  }

  _receive (peerId, message) {
    if (message.type) {
      if (message.type === 'MConnectTo' ||
                message.type === 'MForwarded' ||
                message.type === 'MForwardTo' ||
                message.type === 'MBridge-status') {
        this._parent._bridge(peerId, message)
      } else if (message.type === 'MResponse' ||
                      message.type === 'MRequest' ||
                      message.type === 'MDirect' ||
                      message.type === 'MDirect-status') {
        this._parent._direct(peerId, message)
      } else {
        throw new Error('Message not handled')
      }
    } else {
      throw new Error('Message not handled')
    }
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
    this._receive(peerId, message)
  }

  /**
     * @private Behavior when this protocol receives a stream from peerId.
     * @param {string} peerId The identifier of the peer that we received a
     * message from.
     * @param {object} stream The stream received.
     */
  _streamed (peerId, stream) {
    this._parent.emit('stream', peerId, stream)
  }

  /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer reachable through the
     * newly added arc.
     * @param {boolean} isOutgoing State if the added arc is outgoing or not.
     */
  _connected (peerId, isOutgoing) {
    if (isOutgoing) {
      if (!this._parent.o.has(peerId)) {
        this._parent.o.set(peerId, 0)
      }
      this._parent.o.set(peerId, this._parent.o.get(peerId) + 1)
      this._parent.emit('open', peerId) // only consider outgoing arcs
    } else {
      if (!this._parent.i.has(peerId)) {
        this._parent.i.set(peerId, 0)
      }
      this._parent.i.set(peerId, this._parent.i.get(peerId) + 1)
    }
  }

  /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer that removed an arc.
     */
  _disconnected (peerId) {
    if (this._parent.o.has(peerId)) {
      this._parent.o.set(peerId, this._parent.o.get(peerId) - 1)
      if (this._parent.o.get(peerId) <= 0) this._parent.o.delete(peerId)
      this._parent.emit('close', peerId) // only outview
    } else if (this._parent.i.has(peerId)) {
      this._parent.i.set(peerId, this._parent.i.get(peerId) - 1)
      if (this._parent.i.get(peerId) <= 0) this._parent.i.delete(peerId)
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
    isOutgoing && this._parent.emit('fail', peerId)
  }
}

module.exports = InternalProtocol
