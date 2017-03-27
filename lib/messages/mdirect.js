'use strict';

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

