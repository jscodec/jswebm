'use strict';

var NO_LACING = 0;
var XIPH_LACING = 1;
var FIXED_LACING = 2;
var EBML_LACING = 3;

class SimpleBlock {

    constructor() {
        this.cluster;// = cluster;
        this.dataInterface;// = dataInterface;
        this.offset;// = blockHeader.offset;
        this.dataOffset;// = blockHeader.dataOffset;
        this.size;// = blockHeader.size;
        this.end;// = blockHeader.end;
        this.loaded = false;
        this.trackNumber = null;
        this.timeCode = -1;
        this.flags = null;
        this.keyframe = false;
        this.invisible = false;
        this.lacing = NO_LACING;
        this.discardable = false;
        this.lacedFrameCount = null;
        this.headerSize = null;
        this.frameSizes = [];
        this.tempCounter = null;
        this.tempFrame = null;
        this.track = null;
        this.frameLength = null;
        this.isLaced = false;
        this.stop = null;// = this.offset + this.size;
        this.status = false;
    }

    init(offset, size, end, dataOffset, dataInterface, cluster) {
        this.cluster = cluster;
        this.dataInterface = dataInterface;
        this.offset = offset;
        this.dataOffset = dataOffset;
        this.size = size;
        this.end = end;
        this.loaded = false;
        this.trackNumber = null;
        this.timeCode = null;
        this.flags = null;
        this.keyframe = false;
        this.invisible = false;
        this.lacing = NO_LACING;
        this.discardable = false;
        this.lacedFrameCount = null;
        this.headerSize = null;
        this.frameSizes = [];
        this.tempCounter = null;
        this.tempFrame = null;
        this.track = null;
        this.frameLength = null;
        this.isLaced = false;
        this.stop = this.offset + this.size;
        this.status = true;
        this.trackEntries = this.cluster.demuxer.tracks.trackEntries;
        this.videoPackets = this.cluster.demuxer.videoPackets;
        this.audioPackets = this.cluster.demuxer.audioPackets;
    }

    reset() {
        this.status = false;
    }

    loadTrack() {
        //could be cleaner
        this.track = this.trackEntries[this.trackNumber - 1];
    }

    load() {
        //6323
        var dataInterface = this.dataInterface;
        if (this.loaded)
            throw "ALREADY LOADED";


        if (this.trackNumber === null) {
            this.trackNumber = dataInterface.readVint();
            if (this.trackNumber === null)
                return null;
            this.loadTrack();
        }

        if (this.timeCode === null) {
            this.timeCode = dataInterface.readUnsignedInt(2);//Be signed for some reason?
            if (this.timeCode === null)
                return null;
        }

        if (this.flags === null) {/// FIX THIS
            this.flags = dataInterface.readUnsignedInt(1);
            if (this.flags === null)
                return null;

            this.keyframe = (((this.flags >> 7) & 0x01) === 0) ? false : true;
            this.invisible = (((this.flags >> 2) & 0x01) === 0) ? false : true;
            this.lacing = ((this.flags & 0x06) >> 1);
            if (this.lacing > 3 || this.lacing < 0)
                throw "INVALID LACING";
        }


        //console.warn(this);
        if (!this.headerSize)
            this.headerSize = dataInterface.offset - this.dataOffset;


        switch (this.lacing) {



            case FIXED_LACING:

                if (!this.frameLength) {
                    this.frameLength = this.size - this.headerSize;
                    if (this.frameLength <= 0)
                        throw "INVALID FRAME LENGTH " + this.frameLength;
                }
                
                if (!this.lacedFrameCount) {
                    this.lacedFrameCount = dataInterface.readUnsignedInt(1);
                    if (this.lacedFrameCount === null)
                        return null;

                    this.lacedFrameCount++;
                }

                var tempFrame = dataInterface.getBinary(this.frameLength - 1);
                
                if (tempFrame === null) {
                    if (dataInterface.usingBufferedRead === false)
                        throw "SHOULD BE BUFFERED READ";
                    //console.warn("frame has been split");
                    return null;
                }
                
                for (var i = 0; i < this.lacedFrameCount; i++) {
                    if (this.track.trackType === 1) {
                        this.videoPackets.push({//This could be improved
                            data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
                            timestamp: timeStamp,
                            keyframeTimestamp: timeStamp,
                            isKeyframe: this.keyFrame
                        });
                    } else if (this.track.trackType === 2) {
                        this.audioPackets.push({//This could be improved
                            data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
                            timestamp: timeStamp
                        });
                    }
                }
                
                
                this.fixedFrameLength = (this.frameLength - 1) / this.lacedFrameCount;
              


                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                //var fullTimeCode = this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }
                
                
                
                tempFrame = null;
                break;


            case EBML_LACING:

            case XIPH_LACING:
                
            case NO_LACING:
                
                 if(this.lacing === EBML_LACING){
                 console.warn("EBML_LACING");
                 }
                 if(this.lacing === XIPH_LACING){
                 console.warn("XIPH_LACING");
                 }
          
                 

                if (!this.frameLength) {
                    this.frameLength = this.size - this.headerSize;
                    if (this.frameLength <= 0)
                        throw "INVALID FRAME LENGTH " + this.frameLength;
                }

               

                var tempFrame = dataInterface.getBinary(this.frameLength);

 
                if (tempFrame === null) {
                    if (dataInterface.usingBufferedRead === false)
                        throw "SHOULD BE BUFFERED READ";
                    //console.warn("frame has been split");
                    return null;
                } else {
                    if (dataInterface.usingBufferedRead === true)
                        throw "SHOULD NOT BE BUFFERED READ";

                    if (tempFrame.byteLength !== this.frameLength)
                        throw "INVALID FRAME";
                }


                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                //var fullTimeCode = this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }


                if (this.track.trackType === 1) {
                    this.videoPackets.push({//This could be improved
                        data: tempFrame,
                        timestamp: timeStamp,
                        keyframeTimestamp: timeStamp,
                        isKeyframe : true
                    });
                } else if (this.track.trackType === 2) {
                    this.audioPackets.push({//This could be improved
                        data: tempFrame,
                        timestamp: timeStamp
                    });
                }

                tempFrame = null;

                break;
            default:
                console.log(this);
                console.warn("LACED ELEMENT FOUND");
                throw "STOP HERE";
        }

        if (this.end !== dataInterface.offset) {

            console.error(this);
            throw "INVALID BLOCK SIZE";
        }


        this.loaded = true;
        this.headerSize = null;
        this.tempFrame = null;
        this.tempCounter = null;
        this.frameLength = null;
    }

}

module.exports = SimpleBlock;
