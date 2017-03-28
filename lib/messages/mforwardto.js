'use strict';

/**
 * Message that asks a peer to forward the piggybacked message to to-peer.
 */
class MForwardTo {
    /**
     * @param {string} from The departure of the message.
     * @param {string} to The arrival of the piggybacked message.
     * @param {object} message The message to piggyback.
     */
    constructor (from, to, message) {
        this.from = from;
        this.to = to;
        this.message = message;
        this.type = 'MForwardTo';        
    };
};

module.exports = MForwardTo;
