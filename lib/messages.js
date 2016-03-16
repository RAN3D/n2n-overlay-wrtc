
module.exports.ConnectToMessage = function(from, to){
    this.protocol = 'n2n-signaling-wrtc';
    this.type = 'ConnectToMessage';
    this.from = from;
    this.to = to;
};

module.exports.ForwardToMessage = function(from, to, message){
    this.protocol = 'n2n-signaling-wrtc';
    this.type = 'ForwardToMessage';
    this.from = from;
    this.to = to;
    this.message = message;
};

module.exports.ForwardedMessage = function(from, to, message){
    this.protocol = 'n2n-signaling-wrtc';
    this.type = 'ForwardedMessage';
    this.from = from;
    this.to = to;
    this.message = message;
};
