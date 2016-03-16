var Neighborhood = require('neighborhood-wrtc');

var MForwardTo = require('./messages.js').MForwardTo;
var MForwarded = require('./messages.js').MForwarded;
var MConnectTo = require('./messages.js').MConnectTo;

function Neighbor(options){
    var protocol = 'n2n-overlay-wrtc';
    
    this.inview = new Neighborhood(options);
    this.outview = new Neighborhood(options);


    var callbacks = function(socket, message){
        return {
            onInitiate: function(offer){
                socket.send(new MForwardTo(message.from, message.to, offer));
            },
            onAccept: function(offer){
                socket.send(new MForwardTo(message.to, message.from, offer));
            }
        };
    };
    
    function receive(socket, message){
//        console.log(message);
        
        
        if (!message.protocol && message.protocol!==protocol){ return; };
        switch (message.type){
        case 'ConnectToMessage':
            this.outview.connection(callbacks(socket, message));
            break;
        case 'ForwardToMessage':
            var destSocket = this.outview.get(message.to) ||
                this.inview.get(message.to);
            destSocket && destSocket.socket.send(
                new MForwarded(message.from,message.to,message.message));
            break;
        case 'ForwardedMessage':
            this.inview.connection(callbacks(socket,message), message.message);
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
    var msg = MConnectTo(from, to);
    fromSocket && fromSocket.socket.send(msg);
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

module.exports = Neighbor;
