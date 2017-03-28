'use strict';

/**
 * Messages traveling between two direct neighbors. No bridge here.
 */
class MDirect {
    /**
     // (TODO) maybe not necessary anymore
     */
    constructor (from, message) {
        this.from = from;
        this.message = message;
        this.type = 'MDirect';
    };
};

