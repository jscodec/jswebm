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

## Methods
`onseek`

`init`

`close`

`receiveInput`

`process`

`dequeueAudioPacket(callback)`

`dequeueVideoPacket(callback)`

`flush(callback)`

`getKeypointOffset(timeSeconds, callback)`

`seekToKeypoint(timeSeconds, callback)`