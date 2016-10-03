'use strict';
var UNSET = -1;
var ElementHeader = require('./ElementHeader.js');

class Cluster {

    constructor(offset, size, end, dataOffset, dataInterface, demuxer) {
        this.demuxer = demuxer; // reference to parent demuxer for passing data
        this.dataInterface = dataInterface;
        this.offset = offset;
        this.size = size;
        //if (end !== -1){
            this.end = end;
        //} 
        //else{
          //  this.end = Number.MAX_VALUE;
        //}
        this.dataOffset = dataOffset;
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
        this.timeCode = null;
        this.tempBlock = null;
        //this.blocks = [];

        this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.tempBlock = new SimpleBlock();


        //this should go somewhere else!!
        //this.demuxer.loadedMetadata = true; // Testing only
        return true;
    }
    
    init(){
        
    }
    
    reset(){
       
    }
    
    load() {
        var status = false;

        while (this.dataInterface.offset < this.end) {
            if (!this.tempElementHeader.status) {
                this.dataInterface.peekAndSetElement(this.tempElementHeader);
                if (!this.tempElementHeader.status)
                    return null;
            }


            switch (this.tempElementHeader.id) {

                case 0xE7: //TimeCode
                    var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
                    if (timeCode !== null)
                        this.timeCode = timeCode;
                    else
                        return null;
                    break;

                case 0xA3: //Simple Block
                    if (!this.tempBlock.status)
                        this.tempBlock.init(
                                this.tempElementHeader.offset,
                                this.tempElementHeader.size,
                                this.tempElementHeader.end,
                                this.tempElementHeader.dataOffset,
                                this.dataInterface,
                                this
                                );
                    this.tempBlock.load();
                    if (!this.tempBlock.loaded)
                        return 0;
                    //else
                    //  this.blocks.push(this.tempBlock); //Later save positions for seeking and debugging
                    this.tempBlock.reset();

                    this.tempEntry = null;
                    this.tempElementHeader.reset();
                    if(this.dataInterface.offset !== this.end)
                        return true;
                    break;

                    //TODO, ADD VOID
                default:

                    //This means we probably are out of the cluster now, double check bounds when end not available
                    break;

            }

            this.tempEntry = null;
            this.tempElementHeader.reset();
            
            //return 1;
        }


        //if (this.dataInterface.offset !== this.end){
        //  console.log(this);
        //throw "INVALID CLUSTER FORMATTING";
        //}


        this.loaded = true;
        return status;
    }
}

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
    }

    reset() {
        this.status = false;
    }

    loadTrack() {
        //could be cleaner
        this.track = this.cluster.demuxer.tracks.trackEntries[this.trackNumber - 1];
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




        if (this.lacing === XIPH_LACING || this.lacing === EBML_LACING) {
            console.warn("DETECTING LACING");
            if (!this.lacedFrameCount) {
                this.lacedFrameCount = dataInterface.readByte();
                if (this.lacedFrameCount === null)
                    return null;

                this.lacedFrameCount++;
            }

            if (!this.tempCounter)
                this.tempCounter = 0;

            while (this.tempCounter < this.lacedFrameCount) {
                var frameSize = dataInterface.readByte();
                if (frameSize === null)
                    return null;
                this.frameSizes.push(frameSize);
                this.tempCounter++;
            }


        }


        //console.warn(this);
        if (!this.headerSize)
            this.headerSize = dataInterface.offset - this.dataOffset;


        switch (this.lacing) {


            case XIPH_LACING:
            case FIXED_LACING:
            case EBML_LACING:
            case NO_LACING:
                /*
                 if(this.lacing === FIXED_LACING){
                 console.warn("FIXED_LACING");
                 }
                 if(this.lacing === EBML_LACING){
                 console.warn("EBML_LACING");
                 }
                 if(this.lacing === XIPH_LACING){
                 console.warn("XIPH_LACING");
                 }
                 if(this.lacing === NO_LACING){
                 console.warn("NO_LACING");
                 }
                 */

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

                    /*
                     if((this.dataInterface.offset - this.tempMarker) !== this.frameLength){
                     console.warn((this.dataInterface.offset - this.tempMarker));
                     throw "OFFSET ERROR";  
                     }*/


                    //console.warn("frame complete");
                }


                if (dataInterface.usingBufferedRead === true)
                    throw "SHOULD NOT BE BUFFERED READ";

                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                //var fullTimeCode = this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }


                if (this.track.trackType === 1) {
                    this.cluster.demuxer.videoPackets.push({//This could be improved
                        data: tempFrame,
                        timestamp: timeStamp,
                        keyframeTimestamp: timeStamp
                    });
                } else if (this.track.trackType === 2) {
                    this.cluster.demuxer.audioPackets.push({//This could be improved
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

module.exports = Cluster;

