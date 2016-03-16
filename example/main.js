var NO = require('n2n-overlay-wrtc');

// # create 3 peers 
var n1 = new NO({webrtc: {trickle:true}});
var n2 = new NO({webrtc: {trickle:true}});
var n3 = new NO({webrtc: {trickle:true}});

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

// #3 n1 chooses to connect n2 to n3
function bridge(){
//    console.log(n1);
    entry1 = n1.outview.living.arr[0]; // ugly
    entry2 = n1.outview.living.arr[1]; // probably better way
    n1.connect(entry1.id, entry2.id);
};
