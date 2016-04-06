var Neighborhood = require('neighborhood-wrtc');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Neighbor, EventEmitter);

var MForwardTo = require('./messages.js').MForwardTo;
var MForwarded = require('./messages.js').MForwarded;
var MConnectTo = require('./messages.js').MConnectTo;
var MDirect = require('./messages.js').MDirect;


/*!
 * \brief A neighbor has an inview and an outview and is able to act as a bridge
 * between its neighbors so they can establish their own communication channels
 */
function Neighbor(options){
    EventEmitter.call(this);
    var protocol = (options && options.protocol) || 'n2n-overlay-wrtc';
    // #1 dissociate entering arcs from outgoing arcs
    this.inview = (options && options.inview) || new Neighborhood(options);
    this.outview = (options && options.outview) || new Neighborhood(options);
    // #2 concise access
    this.i = this.inview;
    this.o = this.outview;
    
    var self = this;
    // #A callbacks when there is a bridge to create a connection
    var callbacks = function(id, message, view){
        return {
            onInitiate: function(offer){
                self.send(id, MForwardTo(message.from, message.to,
                                         offer,
                                         protocol));
            },
            onAccept: function(offer){
                self.send(id, MForwardTo(message.to, message.from,
                                         offer,
                                         protocol));
            }
        };
    };
    // #B callbacks when it establishes a connection to a neighbor, either
    // this -> neighbor or neigbhor -> this. It is worth noting that if it
    // a channel exists in the inview and we want to create an identical in the
    // outview, a new channel must be created; for the peer that owns the arc
    // in its outview can destroy it without warning.
    var directCallbacks = function(id, idView, view){
        return {
            onInitiate: function(offer){
                self.send(id, MDirect(idView, offer, protocol));
            },
            onAccept: function(offer){
                self.send(id, MDirect(idView, offer, protocol));
            }
        };
    };      

    // #C receive a message from an arc, it forwards it to a listener
    // of this module, otherwise, it keeps and interprets it.
    function receive(id, message){
        // #1 redirect       
        if (!message.protocol || message.protocol!==protocol){
            self.emit('receive', id, message);
            return; // ugly early return
        };
        // #2 otherwise, interpret
        switch (message.type){
        case 'MConnectTo': // #A a neighbor asks us to connect to a remote one
            if (message.to && message.from){
                self.connection(callbacks(id, message, 'outview'));
            } else { // #B a neighbor asks us to connect to him
                self.connection(directCallbacks(id, self.outview.ID,'outview'));
            };
            break;
        case 'MForwardTo': // #C a message is to be forwarded to a neighbor
            self.send(message.to, MForwarded(message.from, message.to,
                                             message.message,
                                             message.protocol));
            break;
        case 'MForwarded': // #D a message has been forwarded to us, deliver
            self.inview.connection(callbacks(id, message, 'inview'),
                                   message.message) ||
                self.outview.connection(message.message);
            break;
        case 'MDirect': // #E a direct neigbhor sends offers to accept
            self.inview.connection(
                directCallbacks(id, message.from, 'inview'),
                message.message) ||
                self.outview.connection(message.message);
            break;            
        };
    };

    this.inview.on('receive', receive);
    this.outview.on('receive', receive);
    
    // #D an arc in one of the view is ready, redirect event
    function ready(view){
        return function(id){ self.emit('ready', id, view); };
    };

    this.inview.on('ready-'+protocol, ready('inview'));
    this.outview.on('ready-'+protocol, ready('outview'));

    // #E a connection failed to establish
    function fail(view){
        return function(){ self.emit('fail', view); };
    };
    
    this.inview.on('fail', fail('inview'));
    this.outview.on('fail', fail('outview'));

    // #F an arc has been remove
    function disconnect(view){
        return function(id) { self.emit('disconnect', id, view); };
    };
    
    this.inview.on('disconnect', disconnect('inview'));
    this.outview.on('disconnect', disconnect('outview'));
    
    /*!
     * \brief connect the peers at the other ends of sockets identified
     * \param from the identifier of the socket leading to a peer which will add
     * a socket in its outview
     * \param to the identifier of the socket leading to a peer which will add 
     * a socket in its inview
     */
    this.connect = function(from, to){
        if (!from && to){
            // #A only the 'to' argument implicitly means from = this
            // this -> to
            self.connection(directCallbacks( to, self.outview.ID, 'outview'));
        } else if (from && !to){
            // #B only the 'from' argument implicitly means to = this
            // from -> this
            self.send(from, MConnectTo(protocol));
        } else {
            // #C ask to the from-peer to the to-peer
            // from -> to
            self.send(from, MConnectTo(protocol, from, to));
        };
    };
    
    /*!
     * \brief bootstrap the network, i.e. first join the network. This peer
     * will add a peer which already belong to the network. The rest of 
     * protocol can be done inside the network with the function connect.
     * \param callbacks see callbacks of neighborhood-wrtc
     * \param message see messages of neighborhood-wrtc
     * \return the id of the socket
     */
    this.connection = function(callbacks, message){
        if (!message || (message && message.type==='MResponse')){
            return this.outview.connection(callbacks, message, protocol);
        } else {
            return this.inview.connection(callbacks, message, protocol);
        };
    };
};

/*!
 * \brief remove an arc of the outview or all arcs
 * \param id the arc to remove, if none, remove all arcs
 */
Neighbor.prototype.disconnect = function(id){
    if (!id){
        this.outview.disconnect();
        this.inview.disconnect();
    } else {
        this.outview.disconnect(id);
    };
};



/*!
 * \brief tries to send the message to the peer identified by id
 * \param id the identifier of the socket used to send the message
 * \param message the message to send
 * \param return true if the message has been sent, false otherwise
 */
Neighbor.prototype.send = function(id, message){
    return this.outview.send(id, message) || this.inview.send(id, message);
};

/*!
 * \brief get the socket corresponding to the id in argument and views
 * \param idOrView id or 'inview' or 'outview'
 * \return a list of entries or an entry
 */
Neighbor.prototype.get = function(idOrView){
    return  ((idOrView==='inview') && this.inview.living.ms.arr) ||// all inview
    ((idOrView==='outview') && this.outview.living.ms.arr) || // all outview
    (idOrView && (this.outview.get(idOrView) ||
                  this.inview.get(idOrView))); // cherry picking
};

/*!
 * \brief simple string representing the in and out views
 * \return a string with in and out views
 */
Neighbor.prototype.toString = function(){
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
};

module.exports = Neighbor;
