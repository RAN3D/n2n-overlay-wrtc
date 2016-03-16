var Neighborhood = require('neighborhood-wrtc');

var ForwardToMessage = require('./messages.js').ForwardToMessage;
var ForwardedMessage = require('./messages.js').ForwardedMessage;
var ConnectToMessage = require('./messages.js').ConnectToMessage;

function Neighbor(options){
    var protocol = 'n2n-signaling-wrtc'
    
    this.inview = new Neighborhood(options);
    this.outview = new Neighborhood(options);


    var callbacks = function(socket, message){
        return {
            onInitiate: function(offer){
                socket.send(
                    new ForwardToMessage(message.from, message.to, offer));
            },
            onAccept: function(offer){
                socket.send(
                    new ForwardToMessage(message.to, message.from, offer));
            }
        };
    };
    
    function receive(socket, message){
        if (!message.protocol && message.protocol!==protocol){ return; };
        switch (message.type){
        case 'ConnectToMessage':
            this.outview.connection(callbacks(socket, message));
            break;
        case 'ForwardToMessage':
            var destSocket = this.outview.get(message.to) ||
                this.inview.get(message.to);
            destSocket && destSocket.send(
                new ForwardedMessage(message.from,message.to,message.message));
            break;
        case 'ForwardedMessage':
            this.inview.connection(callbacks(socket,message), message.message);
            break;
        };
    };
    
    this.inview.on('receive', receive);
    this.outview.on('receive', receive);
};


module.exports = Neighbor;
