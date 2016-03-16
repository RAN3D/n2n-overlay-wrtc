
module.exports.MConnectTo = function(from, to){
    return { protocol: 'n2n-overlay-wrtc',
             type: 'MConnectTo',
             from: from,
             to: to };
};

module.exports.MForwardTo = function(from, to, message){
    this.protocol = 'n2n-overlay-wrtc';
    this.type = 'MForwardTo';
    this.from = from;
    this.to = to;
    this.message = message;
};

module.exports.MForwarded = function(from, to, message){
    this.protocol = 'n2n-overlay-wrtc';
    this.type = 'MForwarded';
    this.from = from;
    this.to = to;
    this.message = message;
};
