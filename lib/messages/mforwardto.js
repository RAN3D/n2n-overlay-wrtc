'use strict';

const MForwardTo = (from, to, message, protocol) => {
    return {
      protocol,
      type: 'MForwardTo',
      from,
      to,
      message
    };
};
