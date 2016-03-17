# n2n-overlay-wrtc

This project aims to ease the creation of overlay networks on top of
WebRTC. Additional WebRTC-specific constraints make such projects more difficult
than they should be. For instance, establishing a connection requires a
round-trip of "offers". Such messages usually transit a dedicated signaling
server. The peers of this project still require a signaling server for their
entrance in the network. Afterwards, peers become signaling servers too, i.e.,
they mediate connections between their direct neighbors.

The way connections are handled are left to the discretion of overlay protocols
built on top of this module. A peer with two neighbors can ask to one of them to
connect to the other. Several overlay network protocols use neighbor-to-neighbor
interactions to converge to a topology exposing the desired properties.

## Installation

Using npm: ```$ npm install n2n-overlay-wrtc```

Using bower: ```$ bower install n2n-overlay-wrtc```

## Usage

```javascript
var NO = require('n2n-overlay-wrtc');

// #1 create a peer. See module neighborhood-wrtc for options
var n1 = new NO(someOptions);

// #2 establish a first connection through any signaling server
n1.connection(callbacksToSignaling);

// #3 connect the neighbor accessible through socket1 to the neighbor
// accessible through socket2. If everything goes right, the former neighbor
// has the latter neighbor in its outview. It is the responsibility of n1 to
// not create self-loop
n1.connect(idSocket1, idSocket2);

// #4 notification that a connection is ready. View is either
// 'inview' or 'outview'. Id is the identifier of the socket that is ready.
n1.on('ready', function(id, view){
  // Maybe a special procedure when you establish
  // the very first connection.
});
```