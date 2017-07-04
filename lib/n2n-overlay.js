'use strict';

const debug = require('debug')('n2n-overlay-wrtc');
const Neighborhood = require('neighborhood-wrtc');
const EventEmitter = require('events');
const merge = require('lodash.merge');
const uuid = require('uuid/v4');


const MForwardTo = require('./messages/mforwardto.js');
const MForwarded = require('./messages/mforwarded.js');
const MConnectTo = require('./messages/mconnectto.js');
const MDirect = require('./messages/mdirect.js');

/**
 * A peer has an inview and an outview, i.e., tables containing sockets to
 * communicate with remote peers. This module transforms a peer so it can act as
 * a bridge between its direct neighbors. Consequently, these neighbors can
 * create their own communication channels: necessary data to establish the 
 * connection travel through the bridge; once the connection is successfully 
 * established, they communicate using their own direct connection.
 */
class Neighbor extends EventEmitter {
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
        super();

        // #0 process the options
        this.options = merge( { pid: uuid(),
                                  peer: uuid(),
                                  retry: 5 }, options);
        // #1 initialize unmutable protocolId
        this.PID = this.options.pid;
        // #2 initialize the neighborhoods /!\ i.peer and o.peer must be ≠
        this.NI = this.options.inview ||
            new Neighborhood( merge(merge( {}, this.options),
                                    {peer: this.options.peer+'-I'}) );
        this.NO = this.options.outview ||
            new Neighborhood( merge(merge( {}, this.options),
                                    {peer: this.options.peer+'-O'}) );
        // #3 initialize the interfaces
        this.II = this.NI.register(this);
        this.IO = this.NO.register(this);
        this.PEER = this.II.peer + '|' + this.IO.peer;
        debug('[%s] registered to ==> %s ==>', this.PID, this.PEER);
        // #4 intialize the tables
        this.i = new Map();
        this.o = new Map();
    };

    /**
     * @private The getter of the identifier of this protocol.
     * @returns {string} The identifier of this protocol.
     */
    _pid () {
        return this.PID;
    };
    
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
                message.type === 'MForwardTo') {
                this._bridge(peerId, message);
            } else if (message.type === 'MResponse' ||
                       message.type === 'MRequest' ||
                       message.type === 'MDirect') {
                this._direct(peerId, message);
            } else {
                this.emit('receive', peerId, message);
            };
        } else {
            this.emit('receive', peerId, message);
        };
    };


    /**
     * @private Behavior when this protocol receives a stream from peerId.
     * @param {string} peerId The identifier of the peer that we received a 
     * message from.
     * @param {object} stream The stream received.
     */
    _streamed (peerId, stream) {
        this.emit('stream', peerId, stream);
    };

    
    /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer reachable through the
     * newly added arc.
     * @param {boolean} isOutgoing State if the added arc is outgoing or not.
     */
    _connected (peerId, isOutgoing) {
        if (isOutgoing){
            if (!this.o.has(peerId)){
                this.o.set(peerId, 0);
            };
            this.o.set(peerId, this.o.get(peerId) + 1 );
            this.emit('open', peerId); // only consider outgoing arcs
        } else {
            if (!this.i.has(peerId)){
                this.i.set(peerId, 0);
            };
            this.i.set(peerId, this.i.get(peerId) + 1 );
        };
    };

    /**
     * @private Update the local view.
     * @param {string} peerId The identifier of the peer that removed an arc.
     */
    _disconnected (peerId) {
        if (this.o.has(peerId)){
            this.o.set(peerId, this.o.get(peerId) - 1 );
            (this.o.get(peerId) <= 0) && this.o.delete(peerId);
            this.emit('close', peerId); // only outview
        } else if (this.i.has(peerId)){
            this.i.set(peerId, this.i.get(peerId) - 1 );
            (this.i.get(peerId) <= 0) && this.i.delete(peerId);
        };
    };

    /**
     * @private Notify failure
     * @param {string} peerId The identifier of the peer we failed to establish
     * a connection with.
     * @param {boolean} isOutgoing State whether or not the failed arc was 
     * supposed to be an outgoing arc.
     */
    _failed (peerId, isOutgoing) {
        // only takes into account the outgoing arcs
        isOutgoing && this.emit('fail', peerId);
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
            this.IO.connect( (req) => {
                this.send(peerId, new MForwardTo(msg.from, msg.to, req),
                          this.options.retry)
                    .catch( (e) => { }); // nothing on catch
            });
        } else if (msg.type && msg.type === 'MForwardTo') {
            // #2 we are the bridge
            this.send(msg.to, new MForwarded(msg.from, msg.to, msg.message),
                      this.options.retry)
                .catch( (e) => { }); // nothing on catch
        } else if (msg.type && msg.type === 'MForwarded' &&
                   msg.message.type === 'MRequest') {
            // #3 we are the acceptor
            this.II.connect( (res) => {
                this.send(peerId, new MForwardTo(msg.to, msg.from, res),
                          this.options.retry)
                    .catch( (e) => { }); // nothing on catch
            }, msg.message );
            // #4 reapplies #2
        } else if (msg.type && msg.type === 'MForwarded' &&
                   msg.message.type === 'MResponse') {
            // #5 we are the finalizor
            this.IO.connect( msg.message );
        };
    };

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
    _direct(peerId, message){
        (message.type === 'MDirect') &&
            this.IO.connect( (req) => {
                this.send(peerId, req, this.options.retry).catch( (e) => { });
            });
        (message.type === 'MRequest') &&
            this.II.connect( (res) => {
                this.send(peerId, res, this.options.retry).catch( (e) => { });
            }, message);
        (message.type === 'MResponse') &&
            this.IO.connect( message );
    };
    
    
    /**
     * Send a message using either the inview or the outview.
     * @param {string} peerId The identifier of the receiver.
     * @param {object} message The message to send.
     * @param {number} [retry = 0] Number of times it retries to send a
     * message.
     * @return {promise} Promise that resolves if the message is sent, reject 
     * otherwise.
     */
    send(peerId, message, retry = 0){
        let promise;
        // #1 normal behavior
        if (this.i.has(peerId)) {
            promise = this.II.send(peerId, message, retry);
        } else if (this.o.has(peerId)) {
            promise = this.IO.send(peerId, message, retry);
        } else {
            // #2 last chance behavior
            promise = new Promise( (resolve, reject) => {
                const _send = (r) => {
                    this.IO.send(peerId, message, 0)
                        .then( () => resolve() )
                        .catch( (e) => this.II.send(peerId, message, 0)
                                .then( () => resolve() )
                                .catch( (e) => {
                                    if (r<retry){
                                        setTimeout( () => {
                                            _send (r+1);
                                        }, 1000);
                                    } else {
                                        reject(e);
                                    }
                                }));};
                _send(0);
            });
        };
        return promise;
    };

    /**
     * Create an arc (establishes a WebRTC connection if need be) from 'from' to
     * 'to'. (TODO) explain function args
     * @param {function|MResponse|string|null} from The identifier of the peer
     * that must initiate the connection. Null implicitely means this.
     * @param {MRequest|string|null} to The identifier of the peer that must
     * accept the connection. Null implicitely means this.
     */
    connect (arg1 = null, arg2 = null) {
        // #1 handle bootstrap using other communication channels than our
        // own.
        if (typeof arg1 === 'function' && arg2 === null) {
            this.IO.connect( (req) => arg1(req) ); // arg1: callback
        } else if (typeof arg1 === 'function' && arg2 !== null) {
            debug('[%s] %s <π= ??? =π= %s',
                  this.PID, this.getInviewId(), arg2.peer);
            this.II.connect( (res) => arg1(res), arg2); // arg1: cb; arg2: msg
        } else if (arg1 !== null && typeof arg1 === 'object' && arg2 === null) {
            this.IO.connect( arg1 ); // arg1: msg
        } else {
            // #2 handle n2n connections
            // #A replace our own identifier by null
            if (arg1!==null && (arg1===this.IO.peer || arg1===this.II.peer)) {
                arg1 = null;
            };
            if (arg2!==null && (arg2===this.IO.peer || arg2===this.II.peer)) {
                arg2 = null;
            };
            
            if (arg1 !== null && arg2 !== null){ 
                // #1 arg1: from; arg2: to
                // from -> this -> to  creates  from -> to
                debug('[%s] %s =π= %s =π> %s', this.PID, arg1, this.PEER, arg2);
                this.send(arg1, new MConnectTo(arg1, arg2),
                          this.options.retry).catch( (e) => { } );
            } else if (arg1 !== null) {
                // #2 arg1: from
                // from -> this  becomes  from => this
                this.send(arg1, new MDirect(),
                          this.options.retry).catch( (e) => { } );
            } else if (arg2 !== null) {
                // #3 arg2: to
                // this -> to becomes this => to
                this._direct(arg2, new MDirect()); // emulate a MDirect receipt
            };
        };        
    };

    /**
     * Remove an arc of the outview or all arcs
     * @param {string} peerId The identifier of the arc to remove.
     */
    disconnect (peerId) {
        if (typeof peerId === 'undefined') {
            this.II.disconnect();
            this.IO.disconnect();
        } else {
            this.IO.disconnect(peerId);
        };
    }

    /**
     * Getter of the inview.
     * @returns {Map} A new map comprising {peerId => occurrences}.
     */
    getInview () {
        return new Map(this.i);
    };

    /**
     * Getter of the inview ID.
     * @returns {string} The identifier of the inview.
     */
    getInviewId () {
        return this.NI.PEER;
    };

    /**
     * Getter of the outview.
     * @returns {Map} A new map comprising {peerId => occurrences}.
     */
    getOutview () {
        return new Map(this.o);
    };

    /**
     * Getter of the inview ID.
     * @returns {string} The identifier of the outview.
     */
    getOutviewId () {
        return this.NO.PEER;
    };

};

module.exports = Neighbor;
