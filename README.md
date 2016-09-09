# FlareWebmDemuxer
A javascript implementation of the Webm Demuxer (matroska).

Building for the OGV.js project.



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




