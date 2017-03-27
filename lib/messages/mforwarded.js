'use strict';

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
