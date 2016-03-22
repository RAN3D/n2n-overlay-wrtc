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
 * between its neighbors
 */
function Neighbor(options){
    EventEmitter.call(this);    
    var protocol = 'n2n-overlay-wrtc';
    
    this.inview = new Neighborhood(options);
    this.outview = new Neighborhood(options);

    var self = this;
    var callbacks = function(socket, message, view){
        return {
            onInitiate: function(offer){
                self.send(socket, MForwardTo(message.from, message.to, offer));
            },
            onAccept: function(offer){
                self.send(socket, MForwardTo(message.to, message.from, offer));
            },
            onReady: function(id){
                self.emit('ready', id, view);
            }
        };
    };
    var directCallbacks = function(socket, view){
        return {
            onInitiate: function(offer){
                self.send(socket, MDirect(offer));
            },
            onAccept: function(offer){
                self.send(socket, MDirect(offer));
            },
            onReady: function(id){
                self.emit('ready', id, view);
            }
        };
    };      
    
    function receive(socket, message){
        if (!message.protocol || message.protocol!==protocol){ return; };
        switch (message.type){
        case 'MConnectTo':
            self.outview.connection(callbacks(socket, message, 'outview'));
            break;
        case 'MForwardTo':
            var destSocket = self.outview.get(message.to) ||
                self.inview.get(message.to);
            self.send(destSocket.socket, MForwarded(message.from,message.to,
                                                    message.message));
            break;
        case 'MForwarded':
            self.inview.connection(callbacks(socket, message, 'inview'),
                                   message.message) ||
                self.outview.connection(message.message);
            break;
        case 'MDirect':
            self.inview.connection(directCallbacks(socket, 'inview'),
                                   message.message) ||
                self.outview.connection(message.message);
            break;            
        };
    };
    
    this.inview.on('receive', receive);
    this.outview.on('receive', receive);
    
    /*!
     * \brief connect the peers at the other ends of sockets identified
     * \param from the identifier of the socket leading to a peer which will add
     * a socket in its outview
     * \param to the identifier of the socket leading to a peer which will add 
     * a socket in its inview
     */
    this.connect = function(from, to){
        if (!to){
            // #A one argument implicitly means from = this            
            var to = from;
            var toSocket = self.outview.get(from) || self.inview.get(from);
            toSocket &&
                self.outview.connection(directCallbacks(toSocket.socket));
        } else {
            // #B ask to the from-peer to the to-peer
            var fromSocket = self.outview.get(from) || self.inview.get(from);
            var toSocket = self.outview.get(to) || self.inview.get(to);  
            fromSocket && toSocket &&
                self.send(fromSocket.socket, MConnectTo(from, to));
        };
    };
};


/*!
 * \brief bootstrap the network, i.e. first join the network. This peer will add
 * a peer which already belong to the network. The rest of protocol can be done
 * inside the network with the function connect.
 * \param callbacks see callbacks of neighborhood-wrtc
 * \param message see messages of neighborhood-wrtc
 * \return the id of the socket
 */
Neighbor.prototype.connection = function(callbacks, message){
    if (!message || (message && message.type==='MResponse')){
        return this.outview.connection(callbacks, message);
    } else {
        return this.inview.connection(callbacks, message);
    };
};

/*!
 * \brief send a message to the socket. Note: it converts the messages
 * into string before sending them. Maybe there is a more regular way.
 * (TODO) check it
 * \param socket the channel to send the message
 * \param message the message to send
 */
Neighbor.prototype.send = function(socket, message){
    var msg = ((message instanceof String) && message) ||
        JSON.stringify(message);
    socket && msg && socket.send(msg);
};

/*!
 * \brief get the socket corresponding to the id in argument and views
 * \param idOrView id or 'inview' or 'outview'
 * \return a list of entries or an entry
 */
Neighbor.prototype.get = function(idOrView){
    return  ((idOrView==='inview') && this.inview.living.ms.arr) ||// all inview
        ((idOrView==='outview') && this.outview.living.ms.arr) || // all outview
        (idOrView && (this.outview.get(id) || this.inview.get(id))); // cherry 
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
