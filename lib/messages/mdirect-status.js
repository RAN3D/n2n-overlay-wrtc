module.exports = class MDirectStatus {
  constructor (jobId, status = true, reason = null) {
    this.type = 'MDirect-status'
    this.jobId = jobId
    this.status = status
    this.reason = reason
  }
}
