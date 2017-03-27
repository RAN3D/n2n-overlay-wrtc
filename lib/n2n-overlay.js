'use strict';

const Neighborhood = require('neighborhood-wrtc');
const EventEmitter = require('events');
const _ = require('lodash');

const MForwardTo = require('./messages.js').MForwardTo;
const MForwarded = require('./messages.js').MForwarded;
const MConnectTo = require('./messages.js').MConnectTo;
const MDirect = require('./messages.js').MDirect;


/**
 * A neighbor has an inview and an outview and is able to act as a bridge
 * between its neighbors so they can establish their own communication channels
 * @access public
 * @extends {EventEmitter}
 */
class Neighbor extends EventEmitter {

    /**
     * @param {object} options options represented as an object (refer to neighborhood-wrtc for other options)
     * @param {object} options.protocol Name of the protocol
     * @param {object} options.inview Inview Socket
     * @param {object} options.outview Outview Socket
     *
     */
    constructor (options) {
        super();

        this.options = {
            protocol: 'n2n-overlay-wrtc'
        };
        this.options = _.merge(this.options, options);

        // #1 dissociate entering arcs from outgoing arcs
        this.inview = (this.options && this.options.inview) || new Neighborhood(this.options);
        this.outview = (this.options && this.options.outview) || new Neighborhood(this.options);
        // #2 concise access
        this.i = this.inview;
        this.o = this.outview;

        const self = this;
        // #A callbacks when there is a bridge to create a connection
        this.callbacks = (id, message, view) => {
            return {
                onInitiate: (offer) => {
                    self.send(id, MForwardTo(message.from, message.to,
                                             offer,
                                             this.options.protocol));
                },
                onAccept: (offer) => {
                    self.send(id, MForwardTo(message.to, message.from,
                                             offer,
                                             this.options.protocol));
                }
            };
        };
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

        this.inview.on('receive', receive);
        this.outview.on('receive', receive);

        // #D an arc in one of the view is ready, redirect event
        this.inview.on('ready-'+this.options.protocol, (id) => self.emit('ready', id, 'inview'));
        this.outview.on('ready-'+this.options.protocol, (id) => self.emit('ready', id, 'outview'));

        // #E a connection failed to establish
        this.inview.on('fail', (reason) => this.emit('failed', 'i', 'inview', reason));
        this.outview.on('fail', (reason) => this.emit('failed', 'o', 'outview', reason));

        // #F an arc has been remove
        this.inview.on('disconnect', (id) => self.emit('disconnect', id, 'inview'));
        this.outview.on('disconnect', (id) => self.emit('disconnect', id, 'outview'));
    }
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
     * bootstrap the network, i.e. first join the network. This peer
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
