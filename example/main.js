const NO = require('n2n-overlay-wrtc');

// # create 3 peers+protocols
const opts1 = {pid: '1', config:{trickle:true} };
const n1 = new NO(opts1);
const opts2 = {pid: '1', config:{trickle:true} };
const n2 = new NO(opts2);
const opts3 = {pid: '1', config:{trickle:true} };
const n3 = new NO(opts3);

const callback = (from, to) => {
    return (offer) => {
        to.connect( (answer) => { from.connect(answer); }, offer);
    };
};

// #1 establishing a connection from n1 to n2
n1.connect(callback(n1, n2));
// #2 establishing a connection from n1 to n3
n1.connect(callback(n1, n3));
// // > console: should see 4 "connection established" messages

setTimeout( () => {
    n1.getOutview().forEach( (occ, o1) => {
        n1.getOutview().forEach( (occ2, o2) => {            
            o1 !== o2 && console.log('%s --> %s', o1, o2);
            o1 !== o2 && n1.connect(o1, o2);
        });
    });   
}, 2000 );

setTimeout( () => {
    n1.connect(null, n2.II.peer);    
}, 4000);

// // #3 n1 chooses to connect n2 to n3 (neighbor2neighbor connection)
// function bridge(){
//      entry1 = n1.outview.living.ms.arr[0]; // ugly
//      entry2 = n1.outview.living.ms.arr[1]; // probably better way
//      console.log(entry1.id+ ' -> ' +entry2.id);
//      n1.connect(entry1.id, entry2.id);

// //     // #4 add a direct connection from n2 to n1 (direct connection)
//      n2.connect(null, n1.outview.ID);
//      n2.connect(null, n1.outview.ID); // x2 but no additionnal connection
// //     // #5 add an arc from n1 to n2 at the initiative of n2
//      n2.connect(n1.outview.ID);
// };
