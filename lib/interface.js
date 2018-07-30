const N2N = require('./n2n-overlay')

module.exports = class Interface extends N2N {
  onBridgeFailed () {
    console.warn('You should remove this default behavior and use your own. It warns you that a bridge has failed locally.')
  }
  _receive (id, message) {
    throw new Error('Message not handled, please implement this function: _receive(peerId, msg) => {}')
  }
}
