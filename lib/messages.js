'use strict';

/**
 * @access private
 */
const MConnectTo = (protocol, from, to) => {
    return {
      protocol,
      type: 'MConnectTo',
      from,
      to
    };
};

/**
 * @access private
 */
const MForwardTo = (from, to, message, protocol) => {
    return {
      protocol,
      type: 'MForwardTo',
      from,
      to,
      message
    };
};

/**
 * @access private
 */
const MForwarded = (from, to, message, protocol) => {
    return {
      protocol: protocol,
      type: 'MForwarded',
      from: from,
      to: to,
      message: message
    };
};

/**
 * @access private
 */
const MDirect = (from, message, protocol) => {
    return {
      protocol,
      type: 'MDirect',
      from,
      message
    };
};

export { MConnectTo, MForwardTo, MForwarded, MDirect };
