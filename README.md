# FlareWebmDemuxer
A javascript implementation of the Webm Demuxer (matroska)


## API

### Properties
#### audioCodec
#### audioFormat
#### videoCodec
#### videoFormat
#### videoPackets
#### audioPackets
#### loadedMetadata
#### frameReady
#### audioReady
#### cpuTime

### Methods
#### onseek
#### init
#### close
#### receiveInput
#### process
#### dequeueAudioPacket(callback)
#### dequeueVideoPacket(callback)
#### flush(callback)
#### getKeypointOffset(timeSeconds, callback)
#### seekToKeypoint(timeSeconds, callback)