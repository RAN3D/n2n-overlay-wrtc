'use strict';

/**
 * Message piggybacking another message that has been forwarded by an
 * intermediate peer.
 */
class MForwarded {
    /**
     * @param {string} from The departure of the piggybacked message.
     * @param {string} to The arrival of the piggybacked message.
     * @param {object} message The piggybacked message to deliver.
     */
    constructor (from, to, message) {
        this.from = from;
        this.to = to;
        this.message = message;
        this.type = 'MForwarded';
    };
};

module.exports = MForwarded;
