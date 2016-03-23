
module.exports.MConnectTo = function(from, to){
    return { protocol: 'n2n-overlay-wrtc',
             type: 'MConnectTo',
             from: from,
             to: to };
};

module.exports.MForwardTo = function(from, to, message){
    return { protocol: 'n2n-overlay-wrtc',
             type: 'MForwardTo',
             from: from,
             to: to,
             message: message };
};

module.exports.MForwarded = function(from, to, message){
    return { protocol: 'n2n-overlay-wrtc',
             type: 'MForwarded',
             from: from,
             to: to,
             message: message };
};

module.exports.MDirect = function(from, message){
    return { protocol: 'n2n-overlay-wrtc',
             type: 'MDirect',
             from: from,
             message: message };
};
