'use strict';

const Neighborhood = require('neighborhood-wrtc');
const EventEmitter = require('events');
const _ = require('lodash');
const uuid = require('uuid/v4');

const MForwardTo = require('./messages/mforwardto.js');
const MForwarded = require('./messages/mforwarded.js');
const MConnectTo = require('./messages/mconnectto.js');

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
     * @param {Neighborhood} [options.inview] The neighborhood used for inviews,
     * i.e., incoming arcs.
     * @param {Neighborhood} [options.outview] The neigbhorhood used for
     * outviews, i.e., outgoing arcs.
     */
    constructor (options) {
        super();

        // #0 process the options
        this.options = { pid: uuid() }; // default
        this.options = _.merge(this.options, options);
        // #1 initialize unmutable protocolId
        this.PID = this.options.pid;        
        // #2 initialize the neighborhoods 
        this.NI = this.options.inview || new Neighborhood(this.options);
        this.NO = this.options.outview || new Neighborhood(this.options);
        // #3 initialize the interfaces
        this.II = this.NI.register(this);
        this.IO = this.NO.register(this);
        // #4 initialize the tables {peerId => occurrences}
        this.i = new Map();
        this.o = new Map();
        
        // #B callbacks when it establishes a connection to a neighbor, either
        // this -> neighbor or neigbhor -> this. It is worth noting that if it
        // a channel exists in the inview and we want to create an identical in the
        // outview, a new channel must be created; for the peer that owns the arc
        // in its outview can destroy it without warning.
        this.directCallbacks = (id, idView, view) => {
            return {
                onInitiate: (offer) => {
                    self.send(id, MDirect(idView, offer, this.options.protocol));
                },
                onAccept: (offer) => {
                    self.send(id, MDirect(idView, offer, this.options.protocol));
                }
            };
        };

        // #C receive a message from an arc, it forwards it to a listener
        // of this module, otherwise, it keeps and interprets it.
        let receive = (id, message) => {
            // #1 redirect
            if (!message.protocol || message.protocol!==this.options.protocol){
                self.emit('receive', id, message);
                return; // ugly early return
            }
            // #2 otherwise, interpret
            switch (message.type){
            case 'MConnectTo': // #A a neighbor asks us to connect to a remote one
                if (message.to && message.from){
                    self.connection(this.callbacks(id, message, 'outview'));
                } else { // #B a neighbor asks us to connect to him
                    self.connection(this.directCallbacks(id, self.outview.ID,'outview'));
                }
                break;
            case 'MForwardTo': // #C a message is to be forwarded to a neighbor
                self.send(message.to, MForwarded(message.from, message.to, message.message, message.protocol));
                break;
            case 'MForwarded': // #D a message has been forwarded to us, deliver
                self.inview.connection(this.callbacks(id, message, 'inview'), message.message) || self.outview.connection(message.message);
                break;
            case 'MDirect': // #E a direct neigbhor sends offers to accept
                self.inview.connection(this.directCallbacks(id, message.from, 'inview'), message.message) || self.outview.connection(message.message);
                break;
            };
        };
    }

    
    received(peerId, message){
        switch (message.type) {
        case 'MConnectTo':
            
        };
    };


    _bridge(peerId, message){
        (message.type === 'MConnectTo') && this.send();
        this.IO.connect(this.);
    };

    /**
     * Send a message using either the inview or the outview.
     * @param {string} peerId The identifier of the receiver.
     * @param {object} message The message to send.
     */
    send(peerId, message){
        let result = null;
        if (this.i.has(peerId)){
            // #1 peer is in the inview
            result = this.II.send(peerId, message);
        } else if (this.o.has(peerId)) {
            // #2 peer is in the outview
            result = this.IO.send(peerId, message);
        } else {
            throw new Ex
        };
    };
    
    /**
     * connect the peers at the other ends of sockets identified
     * @param {string} from the identifier of the socket leading to a peer which will add
     * a socket in its outview
     * @param {string} to the identifier of the socket leading to a peer which will add
     * a socket in its inview
     * @return {void}
     */
    connect (from, to){
        if (!from && to){
            // #A only the 'to' argument implicitly means from = this
            // this -> to
            this.connection(this.directCallbacks( to, this.outview.ID, 'outview'));
        } else if (from && !to){
            // #B only the 'from' argument implicitly means to = this
            // from -> this
            this.send(from, MConnectTo(this.options.protocol));
        } else {
            // #C ask to the from-peer to the to-peer
            // from -> to
            this.send(from, MConnectTo(this.options.protocol, from, to));
        }
    }

    /**
     * Bootstrap the network, i.e. first join the network. This peer
     * will add a peer which already belong to the network. The rest of
     * protocol can be done inside the network with the function connect.
     * @param {callback} callbacks see callbacks of neighborhood-wrtc
     * @param {object} message see messages of neighborhood-wrtc
     * @return {string} the id of the socket
     */
    connection (callbacks, message){
        if (!message || (message && message.type==='MResponse')){
            return this.outview.connection(callbacks, message, this.options.protocol);
        } else {
            return this.inview.connection(callbacks, message, this.options.protocol);
        }
    }
    /**
     * remove an arc of the outview or all arcs
     * @param {string} id the arc to remove, if none, remove all arcs
     */
    disconnect (id) {
        if (!id){
            this.outview.disconnect();
            this.inview.disconnect();
            return true;
        } else {
            return this.outview.disconnect(id);
        }
    }



    /**
     * Send the message to the peer identified by id
     * @param {string} id the identifier of the socket used to send the message
     * @param {object} message the message to send
     * @return {boolean} true if the message has been sent, false otherwise
     */
    send (id, message) {
        return this.outview.send(id, message) || this.inview.send(id, message);
    }

    /**
     * get the socket corresponding to the id in argument and views
     * @param {string} idOrView string id or 'inview' or 'outview'
     * @return a list of entries or an entry
     */
    get (idOrView) {
        return  ((idOrView==='inview') && this.inview.living.ms.arr) ||// all inview
        ((idOrView==='outview') && this.outview.living.ms.arr) || // all outview
        (idOrView && (this.outview.get(idOrView) ||
                      this.inview.get(idOrView))); // cherry picking
    }

    /**
     * simple string representing the in and out views
     * @return {void} a string with in and out views
     */
    toString () {
        var result = '';
        result += 'IDS [' + this.inview.ID +', '+ this.outview.ID +'] ';
        result += 'In {';
        var I = this.get('inview');
        for (var i = 0; i < I.length; ++i){
            result +=  I[i].id + ' x' + I[i].occ + '; ';
        };
        result += '}  Out {';
        var O = this.get('outview');
        for (var i = 0; i < O.length; ++i){
            result +=  O[i].id + ' x' + O[i].occ + '; ';
        };
        result += '}';
        return result;
    }


}

module.exports = Neighbor;
