# FlareWebmDemuxer
A javascript implementation of the Webm Demuxer (matroska).

Building for the OGV.js project.

## Algorithm Overview
The demuxer holds a queue of arrayBuffers which are sent in from the main player controller.
 The difficulty lies in the way the buffers come in. In order to achieve progressive downloading, we must parse the data
as it comes in, but it is not possible to ensure that the elements will be completely contained in one chunk ie: the elements can be arbitrarily broken up across one ore more incoming buffers.


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




