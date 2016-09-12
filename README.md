# FlareWebmDemuxer
A javascript implementation of the Webm Demuxer (matroska).

Building for the OGV.js project.

## Algorithm Overview
The demuxer holds a queue of arrayBuffers which are sent in from the main player controller.
 The difficulty lies in the way the buffers come in. In order to achieve progressive downloading, we must parse the data
as it comes in, but it is not possible to ensure that the elements will be completely contained in one chunk 
ie: the elements can be arbitrarily broken up across one ore more incoming buffers.

### DataInterface
* `receiveInput(data)` receives arrayBuffer chunks of arbitrary length.
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
 
![Alt](./EBML.png)

# API

## Properties
`audioCodec` String describing the audio codec

`audioFormat`

`videoCodec` Plain text readable video codec string

`videoFormat`

`videoPackets`

`audioPackets`

`loadedMetadata`

`frameReady`

`audioReady`

`cpuTime`

`duration`

`tracks`

`processing`

`seekable`

## Methods
`onseek`

`init():Promise`

`receiveInput`

`process(data:ArrayBuffer):Promise`

`dequeueAudioPacket(callback)`

`dequeueVideoPacket(callback)`

`flush(callback)`

`getKeypointOffset(timeSeconds, callback)`

`seekToKeypoint(timeSeconds, callback)`

`onpacket: function(event:Event)|null`

`getKeypointOffset(timeSeconds:number):Promise`

`flush():Promise`

`close()`




