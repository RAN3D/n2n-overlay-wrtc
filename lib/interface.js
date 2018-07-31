const N2N = require('./n2n-overlay')

module.exports = class Interface extends N2N {
  constructor (...args) {
    super(...args)
    this._bus.on('BRIDGE_FAILED', () => this.onBridgeFailed())
    this.on('open', (...openargs) => this.onOpen(...openargs))
    this.on('close', (...closeargs) => this.onClose(...closeargs))
    this.on('fail', (...failargs) => this.onFail(...failargs))
    this.on('stream', (...streamargs) => this.onStream(...streamargs))
  }

  // PUBLIC FUNCTIONS
  // .channel(object): create a unicast-definition channel for sending messages to a specific peer
  // .stream(peerId, stream, retry): send a stream to peerId with a number of retry if needed
  // .connection(N2N, callback): connection to another N2N or use a signaling service to connect with
  // .acceptOffer(offer): use in conjunction to the connection method with the signaling service, when you receive an offer, use this function to accept this offer
  // .connectionFromThisToPeer(peerId): add an arc from us to peerId, for an existing connection (us:outview) -> (from:inview)
  // .connectionFromPeertoThis(peerId): add an arc from peerId to us (from:outview) -> (us:inview)
  // .bridge(from, to): initiate a connection between 2 neighbors from and to
  // .connect(from, to): All in one method, detect for you what kind of method you have to use.
  // .disconnect(peerId || null): disconnect one arc or all of them
  // .neighbours(): return an object containing inview and outview with sockets and occurences and peerIds
  // .uniqNeighbours(true||false): return an array of uniq reacheable connection without -I or -O, if true, add a -O in order to use this arc for sending messages
  // .getInview(): return the local inview Map containing as (key, value): (peerId, occurences)
  // .getOutview(): return the local outview Map containing as (key, value): (peerId, occurences)
  // .getInviewId(): return our inview Id
  // .getOutviewId(): return our outviewId

  /**
   * @public
   * Called when we receive a `message` from `id`
   * @param  {String} id      peerId that sends to us the message
   * @param  {[type]} message Message received from ID
   * @return {void}
   */
  _receive (id, message) {
    throw new Error('Message not handled, please implement this function: _receive(peerId, msg) => {}')
  }

  /**
   * Called when a bridge failed locally and we cannot reach the initiator of the bridge.
   * @param {String} initiator ID of the peer that requested a bridge connection between us and a neighbor of initiator
   * @param {String} us Our ID
   * @param {String} to The ID of the peer that should be connected with
   * @return {void}
   */
  onBridgeFailed (initiator, us, to) {
    console.warn('You should remove this default behavior and use your own. It warns you that a bridge has failed locally.')
  }
  /**
   * Called when a connection is opened
   * @param  {[type]} peerId ID of the peer that has been opened
   * @return {void}
   */
  onOpen (peerId) {
    console.warn('You should remove this default behavior and use your own. It warns you that a connection has been opened.')
  }
  /**
   * Called when a connection is closed
   * @param  {String} peerId ID of the peer that has been closed
   * @return {void}
   */
  onClose (peerId) {
    console.warn('You should remove this default behavior and use your own. It warns you that a connection has been closed.')
  }
  /**
   * Called when a connection failed
   * @param  {String} peerId ID of the peer that failed
   * @return {void}
   */
  onFail (peerId) {
    console.warn('You should remove this default behavior and use your own. It warns you that a connection has failed.')
  }
  /**
   * Called when we receive a stream
   * @param  {String} peerId ID of the emitter
   * @param  {MediaStream} stream Stream
   * @return {void}
   */
  onStream (peerId, stream) {
    console.warn('You should remove this default behavior and use your own. It warns you that a stream has been received.')
  }
}
