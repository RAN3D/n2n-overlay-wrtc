'use strict'
/**
 * Messages traveling between two direct neighbors. It requests from the
 * receiving peer that it initiates a connection with the emitter.
 */
class MDirect {
  constructor (jobId) {
    this.type = 'MDirect'
    this.jobId = jobId
  };
};

module.exports = MDirect
