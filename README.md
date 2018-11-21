# Webm Demuxer
A javascript implementation of the Webm Demuxer (matroska). View a demo of a dumux result [here](https://jscodec.github.io/jswebm/)
Better examples and reworked api coming soon.
# API Proposal
## JsWebm
### Properties
Top Level wrapper and interface.
* `videoPackets` : Array of demuxed video packets
* `audioPackets` : Array of demuxed audio packets
*  `eof` : Boolean, if the end of the file has been reached
### Functions
* `queueData(buffer)` : queue an incoming chunck of data, must be sequential
* `demux()` : Attempts to parse up to 1 new packet, maybe return promise and reject if current buffer runs out

# Example
```javascript
const demuxer = new JsWebm();
demuxer.queueData(buffer);
while (!demuxer.eof) {
  demuxer.demux();
}
console.log(demuxer);
console.log(`total video packets : ${demuxer.videoPackets.length}`);
console.log(`total audio packets : ${demuxer.audioPackets.length}`);
```

### Packet format
```Javascript
{
  data: ArrayBuffer(3714) {},
  isKeyframe: false,
  keyframeTimestamp: 0,
  timestamp: 0,
}
```
# Webm Demuxer
Running the demo
`npm install`
`node test/example.js`
Then put your example file in the test folder, then in customFileExample.js, put the file name there.

`fileRequest.open("GET", "PUT YOUR SAMPLE FILE HERE", true);`

It will print the demuxer state to the console after processing it.

Will be updating the demo this week and the readme since the api is totally out of date. Will take suggestions on api. Any help is welcome, project needs a lot of maintenance.

## Change Log
* V0.0.3
    * Working on ogv.js 1.3.1 
    * Added basic support for Matroska Files
    * Added support for Tags Element
    * Added Support for Fixed size, and EBML laced elements

## Algorithm Overview
The demuxer holds a queue of arrayBuffers which are sent in from the main player controller.
 The difficulty lies in the way the buffers come in. In order to achieve progressive downloading, we must parse the data
as it comes in, but it is not possible to ensure that the elements will be completely contained in one chunk 
ie: the elements can be arbitrarily broken up across one ore more incoming buffers.

__Main goal__ : To parse the incoming buffers without unnecessary rewrites. The only write will be the time the final frame buffer is made which will be sent off to the decoders.

### DataInterface Class
* `receiveInput(data)` receives arrayBuffer chunks of arbitrary length, adds to queue
* `process(data:ArrayBuffer)` is called from main loop
    * Parse as much as possible then exit.
    * Must pick up parsing where it left off.
    * Not possible to know if enough data available to parse.

### Matroska Parsing
The matroska format uses the EBML principal, which is essentially a type of markdown language like xml which can be applied to binary files. The elements come in 2 basic types: container types, which contain sub elements called __Master Elements__, and 7 data type elements. All elements contain a 2 part header, plus their payload. The header contains an id, which can range in length from 1 to 4 bytes, and a size which ranges from 1 to 8 bytes. __Vint__ or variable sized integers, used for the id and size contain the length of their respective integer in the first byte.

The algorithm will then work as follows:
* Read first byte
* Calculate byte width of Vint
* Test if there are enough bytes available in current buffer
    * If yes, read entire Vint
    * If not, use buffered read method saving state at each position (more overhead)
* At each stage check if there are remaining bytes
    * If no, dequeue buffer
        * If no more buffers, return null or false (can't decide yet)
* Upon next call to process, must pick up where it left off
 

__Example of Element spread across 2 buffers__

![Alt](./EBML.png)

__Closeup of Vint or Element ID__

![Alt](./vint.png)

# API

Coming Soon!

