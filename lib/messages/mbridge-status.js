module.exports = class MBridgeStatus {
  constructor (jobId, status = true, reason = null) {
    this.type = 'MBridge-status'
    this.jobId = jobId
    this.status = status
    this.reason = reason
  }
}
