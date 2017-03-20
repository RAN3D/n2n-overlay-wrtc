'use strict';

module.exports.MConnectTo = (protocol, from, to) => {
    return {
      protocol,
      type: 'MConnectTo',
      from,
      to
    };
};

module.exports.MForwardTo = (from, to, message, protocol) => {
    return {
      protocol,
      type: 'MForwardTo',
      from,
      to,
      message
    };
};

module.exports.MForwarded = (from, to, message, protocol) => {
    return {
      protocol: protocol,
      type: 'MForwarded',
      from: from,
      to: to,
      message: message
    };
};

module.exports.MDirect = (from, message, protocol) => {
    return {
      protocol,
      type: 'MDirect',
      from,
      message
    };
};
