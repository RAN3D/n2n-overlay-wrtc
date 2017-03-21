# n2n-overlay-wrtc

This project aims to ease the creation of overlay networks on top of
WebRTC. Additional WebRTC-specific constraints make such projects more difficult
than they should be. For instance, establishing a connection requires a
round-trip of "offers". Such messages usually transit a dedicated signaling
server. The peers of this project still require a signaling server for their
entrance in the network. Afterwards, peers become signaling servers too, i.e.,
they mediate connections between their direct neighbors.

This module divides the entering arcs (inview) from the outgoing arcs (outview).

The way connections are handled are left to the discretion of overlay protocols
built on top of this module. A peer with two neighbors can ask to one of them to
connect to the other. Several overlay network protocols use neighbor-to-neighbor
interactions to converge to a topology exposing the desired properties.

## Installation

Using npm: ```$ npm install n2n-overlay-wrtc```

Using bower: ```$ bower install n2n-overlay-wrtc```

## Usage

```js
var NO = require('n2n-overlay-wrtc').default;

// #1 create a peer. See module neighborhood-wrtc for options
var n1 = new NO(someOptions);

// #2 establish a first connection through any signaling server
n1.connection(callbacksToSignaling);

// #3 connect the neighbor accessible through socket1 to the neighbor
// accessible through socket2. If everything goes right, the former neighbor
// has the latter neighbor in its outview. It is the responsibility of n1 to
// not create self-loop
// #A connect two neighbors
n1.connect(idFrom, idTo);

// #B connect a neighbor to us, idTo is implicitely us
n1.connect(idFrom);

// #C add an arc to a neigbhor, idFrom is implicitely us
n1.connect(null, idTo);

// #4 remove an arc or completely leave the network
// #A it removes an arc. If multiple occurrences of the arcs are found, the
// socket is not destroyed.
n1.disconnect(id);

// #B remove everything
n1.disconnect();

// #5 get the element of the inview, or the outview, or an entry in particular
var inview = n1.get('inview');
var outview = n1.get('outview');
var entry = n1.get(id);

// #6 send a message to a neighbor using the identifier of the arcs
// targeting a neighbor.
var success = n1.send(id, message);

// #7 retrieve the content of views as a string
var s = n1.toString();
```

```js
// #1 notification that a connection is ready. View is either
// 'inview' or 'outview'. Id is the identifier of the socket that is ready.
n1.on('ready', function(id, view){
  // Maybe a special procedure when you establish
  // the very first connection.
});

// #2 a message has been receive from the identified arc
n1.on('receive', function(id, message){
  // do something with the message
});

// #3 event emitted when an arc disconnect. It provides the identifier
// of the disconnected arcs along with the view it comes from.
n1.on('disconnect', function(id, view){
  // update view
});

// #4 an arc failed to establish. The view where the fail happened is provided.
n1.on('fail', function(view){
  // do something accordingly
});
```


Example with a bridge (provided in example folder):
```js
var NO = require('n2n-overlay-wrtc').default;

var opts = {
  webrtc: {
    trickle:true
  },
  verbose:true
};

// # create 3 peers
var n1 = new NO(opts);
var n2 = new NO(opts);
var n3 = new NO(opts);

var twoconnections = 2 * 2;

var callbacks = function(src, dest){
    return {
        onInitiate: function(offer){
            dest.connection(callbacks(dest, src), offer);
        },
        onAccept: function(offer){
            dest.connection(offer);
        },
        onReady: function(){
            --twoconnections;
            console.log("Connection established");
            if (twoconnections <=0){bridge();};
        }
    };
};

// #1 establishing a connection from n1 to n2
var id1 = n1.connection(callbacks(n1, n2));
// #2 establishing a connection from n1 to n3
var id2 = n1.connection(callbacks(n1, n3));
// > console: should see 4 "connection established" messages

// #3 n1 chooses to connect n2 to n3 (neighbor2neighbor connection)
function bridge(){
     entry1 = n1.outview.living.ms.arr[0]; // ugly
     entry2 = n1.outview.living.ms.arr[1]; // probably better way
     console.log(entry1.id+ ' -> ' +entry2.id);
     n1.connect(entry1.id, entry2.id);

//     // #4 add a direct connection from n2 to n1 (direct connection)
     n2.connect(null, n1.outview.ID);
     n2.connect(null, n1.outview.ID); // x2 but no additionnal connection
//     // #5 add an arc from n1 to n2 at the initiative of n2
     n2.connect(n1.outview.ID);
};
```
