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
