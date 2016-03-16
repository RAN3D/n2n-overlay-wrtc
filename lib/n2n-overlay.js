var Neighborhood = require('neighborhood-wrtc');

var MForwardTo = require('./messages.js').MForwardTo;
var MForwarded = require('./messages.js').MForwarded;
var MConnectTo = require('./messages.js').MConnectTo;

function Neighbor(options){
    var protocol = 'n2n-overlay-wrtc';
    
    this.inview = new Neighborhood(options);
    this.outview = new Neighborhood(options);

    var self = this;
    var callbacks = function(socket, message){
        return {
            onInitiate: function(offer){
                self.send(socket, MForwardTo(message.from, message.to, offer));
            },
            onAccept: function(offer){
                self.send(socket, MForwardTo(message.to, message.from, offer));
            },
        };
    };

    function receive(socket, message){
        if (!message.protocol || message.protocol!==protocol){ return; };
        switch (message.type){
        case 'MConnectTo':
            self.outview.connection(callbacks(socket, message));
            break;
        case 'MForwardTo':
            var destSocket = self.outview.get(message.to) ||
                self.inview.get(message.to);
            self.send(destSocket.socket, MForwarded(message.from,message.to,
                                                    message.message));
            break;
        case 'MForwarded':
            self.outview.connection(message.message);
            self.inview.connection(callbacks(socket,message), message.message);
            break;
        };
    };
    
    this.inview.on('receive', receive);
    this.outview.on('receive', receive);
};

/*!
 * \brief connect the peers at the other ends of sockets identified
 * \param from the identifier of the socket leading to a peer which will add
 * a socket in its outview
 * \param to the identifier of the socket leading to a peer which will add 
 * a socket in its inview
 */
Neighbor.prototype.connect = function(from, to){
    var fromSocket = this.outview.get(from) || this.inview.get(from);
    this.send(fromSocket.socket, MConnectTo(from, to));
};

/*!
 * \brief bootstrap the network, i.e. first join the network. This peer will add
 * a peer which already belong to the network. The rest of protocol can be done
 * inside the network with the function connect.
 * \param callbacks see callbacks of neighborhood-wrtc
 * \param message see messages of neighborhood-wrtc
 */
Neighbor.prototype.connection = function(callbacks, message){
    if (!message || (message && message.type==='MResponse')){
        this.outview.connection(callbacks, message);
    } else {
        this.inview.connection(callbacks, message);
    };
};

/*!
 * \brief send a message to the socket
 * \param socket the channel to send the message
 * \param message the message to send
 */
Neighbor.prototype.send = function(socket, message){
    var msg = ((message instanceof String) && message) ||
        JSON.stringify(message);
    socket && msg && socket.send(msg);
};

module.exports = Neighbor;
