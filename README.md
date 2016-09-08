# FlareWebmDemuxer
A javascript implementation of the Webm Demuxer (matroska)



## Properties
`audioCodec` String describing the audio codec

`audioFormat`

`videoCodec` String describing video codec

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