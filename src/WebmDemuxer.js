'use strict';

var DataInterface = require('./DataInterface.js');
var SeekHead = require('./SeekHead.js');
var SegmentInfo = require('./SegmentInfo.js');
var Tracks = require('./Tracks.js');
var Cluster = require('./Cluster.js');
var Cues = require('./Cues.js');
var ElementHeader = require('./ElementHeader.js');

//States
var STATE_INITIAL = 0;
var STATE_DECODING = 1;
var STATE_SEEKING = 2;
var META_LOADED = 3;
var STATE_FINISHED = 4;
var EXIT_OK = 666;


var getTimestamp;
if (typeof performance === 'undefined' || typeof performance.now === 'undefined') {
    getTimestamp = Date.now;
} else {
    getTimestamp = performance.now.bind(performance);
}

/**
 * @classdesc Wrapper class to handle webm demuxing
 */
class FlareWebmDemuxer {

    constructor() {
        this.shown = false; // for testin
        this.clusters = [];
        this.segmentInfo = [];
        this.state = STATE_INITIAL;
        this.videoPackets = [];
        this.audioPackets = [];
        this.loadedMetadata = false;
        this.seekable = true;//keep false until seek is finished
        this.dataInterface = new DataInterface();
        this.segment = null;
        this.currentElement = null; // placeholder for last element
        this.segmentIsLoaded = false; // have we found the segment position
        this.segmentDataOffset;
        this.headerIsLoaded = false;
        this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.currentElement = null;
        this.segmentInfo = null; // assuming 1 for now
        this.tracks = null;
        this.currentCluster = null;
        this.cpuTime = 0;
        this.seekHead = null;
        this.cuesLoaded = false;
        this.isSeeking = false;
        this.tempSeekPosition = -1;
        this.loadingCues = false;
        this.seekCueTarget = null;
        this.eof = false;

        Object.defineProperty(this, 'duration', {
            get: function () {
                if (this.segmentInfo.duration < 0)
                    return -1;
                return this.segmentInfo.duration / 1000;// / 1000000000.0; ;
            }
        });

        Object.defineProperty(this, 'frameReady', {
            get: function () {
                return this.videoPackets.length > 0;
            }
        });

        Object.defineProperty(this, 'hasAudio', {
            get: function () {
                if (this.loadedMetadata && this.audioCodec) {
                    return true;
                } else {
                    return false;
                }
            }
        });


        Object.defineProperty(this, 'audioFormat', {
            get: function () {
                var channels;
                var rate;
                for (var i in this.tracks.trackEntries) {
                    var trackEntry = this.tracks.trackEntries[i];
                    if (trackEntry.trackType === 2) { // audio track
                        channels = trackEntry.channels;
                        rate = trackEntry.rate;
                        break;
                    }
                }
                //console.error("channels : " + channels + "rate : " + rate);
                var test;
                return test;
                return {
                    channels: channels,
                    rate: rate
                };
            }
        });

        Object.defineProperty(this, 'videoFormat', {
            //in case multiple video tracks? maybe make single track since probably slower to loop
            get: function () {
                var tempTrack;
                for (var i in this.tracks.trackEntries) {
                    var trackEntry = this.tracks.trackEntries[i];
                    if (trackEntry.trackType === 1) { // video track
                        tempTrack = trackEntry;
                        break;
                    }
                }
                var fps = 0;//For now?
                return {
                    width: tempTrack.width,
                    height: tempTrack.height,
                    chromaWidth: tempTrack.width >> 1,
                    chromaHeight: tempTrack.height >> 1,
                    cropLeft: tempTrack.pixelCropLeft,
                    cropTop: tempTrack.pixelCropTop,
                    cropWidth: tempTrack.width - tempTrack.pixelCropLeft - tempTrack.pixelCropRight,
                    cropHeight: tempTrack.height - tempTrack.pixelCropTop - tempTrack.pixelCropBottom,
                    displayWidth: tempTrack.displayWidth,
                    displayHeight: tempTrack.displayHeight,
                    fps: fps
                };
            }
        });

        Object.defineProperty(this, 'audioReady', {
            get: function () {
                return this.audioPackets.length > 0;
            }
        });

        Object.defineProperty(this, 'audioTimestamp', {
            get: function () {
                if (this.audioPackets.length > 0) {
                    return this.audioPackets[0].timestamp;
                } else {
                    return -1;
                }
            }
        });

        Object.defineProperty(this, 'frameTimestamp', {
            get: function () {
                if (this.videoPackets.length > 0) {
                    return this.videoPackets[0].timestamp;
                } else {
                    return -1;
                }
            }
        });

        Object.defineProperty(this, 'keyframeTimestamp', {
            get: function () {
                if (this.videoPackets.length > 0) {
                    return this.videoPackets[0].keyframeTimestamp;
                } else {
                    return -1;
                }
            }
        });

        Object.defineProperty(this, 'hasVideo', {
            get: function () {
                if (this.loadedMetadata && this.videoCodec) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        //Only need this property cause nest egg has it

        Object.defineProperty(this, 'videoCodec', {
            get: function () {
                var codecID;
                //Multiple video tracks are allowed, for now just return the first one
                for (var i in this.tracks.trackEntries) {
                    var trackEntry = this.tracks.trackEntries[i];
                    if (trackEntry.trackType === 1) { // video track
                        codecID = trackEntry.codecID;
                        break;
                    }


                }
                var codecName;
                switch (codecID) {
                    case "V_VP8" :
                        codecName = "vp8";
                        break;
                    default:
                        codecName = null;
                        break;
                }
                ;

                return codecName;

            }
        });


        Object.defineProperty(this, 'audioCodec', {
            get: function () {
                var codecID;
                //Multiple video tracks are allowed, for now just return the first one
                for (var i in this.tracks.trackEntries) {
                    var trackEntry = this.tracks.trackEntries[i];
                    if (trackEntry.trackType === 2) {
                        codecID = trackEntry.codecID;
                        break;
                    }


                }
                var codecName;
                switch (codecID) {
                    case "A_VORBIS" :
                        codecName = "vorbis";
                        break;
                    default:
                        codecName = null;
                        break;
                }
                ;

                return codecName;

            }
        });

        console.log('%c FLARE WEBM DEMUXER LOADED', 'background: #F27127; color:  #2a2a2a');
    }

    /**
     * Times a function call
     */
    time(func) {
        var start = getTimestamp(),
                ret;
        ret = func();
        var delta = (getTimestamp() - start);
        this.cpuTime += delta;
        //console.log('demux time ' + delta);
        return ret;
    }

    /**
     * 
     * @param {function} callback
     */
    init(callback) {

        callback();
    }

    receiveInput(data, callback) {
        var ret = this.time(function () {
            //console.log("got input");
            this.dataInterface.recieveInput(data);
        }.bind(this));
        callback();

    }

    process(callback) {

        var start = getTimestamp();
        var status = false;
        //console.warn("processing");


        //this.processing = true;

        switch (this.state) {
            case STATE_INITIAL:
                this.initDemuxer();
                if (this.state !== STATE_DECODING)
                    break;
            case STATE_DECODING:
                status = this.load();
                //if (this.state !== STATE_FINISHED)
                break;
            case STATE_SEEKING:
                status = this.processSeeking();
                //if (this.state !== META_LOADED)
                break;
            default:
            //fill this out
        }

        //this.processing = false;
        var delta = (getTimestamp() - start);
        this.cpuTime += delta;
        var result;
        //return status;
        if (status === 1 || status === true) {
            result = 1;
        } else {
            result = 0;
        }

        callback(!!result);
    }

    /**
     * General process loop, 
     * TODO, refactor this!!!!!
     */
    load() {
        var status = false;
        
        while (this.dataInterface.offset < this.segment.end) {
            if (!this.tempElementHeader.status) {
                this.dataInterface.peekAndSetElement(this.tempElementHeader);
                if (!this.tempElementHeader.status)
                    return null;
            }
            
            switch (this.tempElementHeader.id) {

                case 0x114D9B74: //Seek Head
                    if (!this.seekHead)
                        this.seekHead = new SeekHead(this.tempElementHeader.getData(), this.dataInterface);
                    this.seekHead.load();
                    if (!this.seekHead.loaded)
                        return false;
                    break;

                case 0xEC: //VOid
                    if (!this.dataInterface.peekBytes(this.tempElementHeader.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.tempElementHeader.size);
                    break;

                case 0x1549A966: //Info
                    if (!this.segmentInfo)
                        this.segmentInfo = new SegmentInfo(this.tempElementHeader.getData(), this.dataInterface);
                    this.segmentInfo.load();
                    if (!this.segmentInfo.loaded)
                        return false;
                    break;

                case 0x1654AE6B: //Tracks
                    if (!this.tracks)
                        this.tracks = new Tracks(this.tempElementHeader.getData(), this.dataInterface, this);
                    this.tracks.load();
                    if (!this.tracks.loaded)
                        return false;
                    break;
                    
                    case 0x1C53BB6B: //Cues
                    if (!this.cues)
                        this.cues = new Cues(this.tempElementHeader.getData(), this.dataInterface, this);
                    this.cues.load();
                    if (!this.cues.loaded)
                        return false;
                    this.cuesLoaded = true;
                    break;

                case 0x1F43B675: //Cluster
                    if (!this.currentCluster) {
                        var metaWasLoaded = this.loadedMetadata;
                        this.currentCluster = new Cluster(
                                this.tempElementHeader.offset,
                                this.tempElementHeader.size,
                                this.tempElementHeader.end,
                                this.tempElementHeader.dataOffset,
                                this.dataInterface,
                                this
                                );
                        if (this.loadedMetadata && !metaWasLoaded)
                            return true;
                    }
                    status = this.currentCluster.load();
                    if (!this.currentCluster.loaded) {
                        return status;
                    }

                    
                    this.currentCluster = null;
                    break;

                
            
                default:
                    this.state = META_LOADED;//testing
                    if (!this.dataInterface.peekBytes(this.tempElementHeader.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.tempElementHeader.size);

                    console.log("UNSUPORTED ELEMENT FOUND, SKIPPING");
                    break;

            }

            this.tempElementHeader.reset();
        }

        this.eof = true;
        this.state = STATE_FINISHED;
        return status;
    }

    initDemuxer() {
        //Header is small so we can read the whole thing in one pass or just wait for more data if necessary
        var dataInterface = this.dataInterface; //cache dataInterface reference

        if (!this.headerIsLoaded) {
            //only load it if we didnt already load it
            if (!this.elementEBML) {
                this.elementEBML = dataInterface.peekElement();
                if (!this.elementEBML)
                    return null;

                if (this.elementEBML.id !== 0x1A45DFA3) { //EBML 
                    //If the header has not loaded and the first element is not the header, do not continue
                    console.warn('INVALID PARSE, HEADER NOT LOCATED');
                }
            }

            var end = this.elementEBML.end;
            while (dataInterface.offset < end) {
                if (!this.tempElementHeader.status) {
                    dataInterface.peekAndSetElement(this.tempElementHeader);
                    if (!this.tempElementHeader.status)
                        return null;
                }

                switch (this.tempElementHeader.id) {

                    case 0x4286: //EBMLVersion
                        var version = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (version !== null)
                            this.version = version;
                        else
                            return null;
                        break;

                    case 0x42F7: //EBMLReadVersion 
                        var readVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (readVersion !== null)
                            this.readVersion = readVersion;
                        else
                            return null;
                        break;

                    case 0x42F2: //EBMLMaxIDLength
                        var maxIdLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (maxIdLength !== null)
                            this.maxIdLength = maxIdLength;
                        else
                            return null;
                        break;

                    case 0x42F3: //EBMLMaxSizeLength
                        var maxSizeLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (maxSizeLength !== null)
                            this.maxSizeLength = maxSizeLength;
                        else
                            return null;
                        break;

                    case 0x4282: //DocType
                        var docType = dataInterface.readString(this.tempElementHeader.size);
                        if (docType !== null)
                            this.docType = docType;
                        else
                            return null;
                        break;

                    case 0x4287: //DocTypeVersion //worked
                        var docTypeVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (docTypeVersion !== null)
                            this.docTypeVersion = docTypeVersion;
                        else
                            return null;
                        break;

                    case 0x4285: //DocTypeReadVersion //worked
                        var docTypeReadVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (docTypeReadVersion !== null)
                            this.docTypeReadVersion = docTypeReadVersion;
                        else
                            return null;
                        break;
                    default:
                        console.warn("Header element not found, skipping");
                        break;

                }

                this.tempElementHeader.reset();
            }

            this.headerIsLoaded = true;
        }
        
        //Now find segment offsets
        if (!this.currentElement)
            this.currentElement = this.dataInterface.peekElement();

        if (!this.currentElement)
            return null;


        switch (this.currentElement.id) {

            case 0x18538067: // Segment
                this.segment = this.currentElement;
                //this.segmentOffset = segmentOffset;
                break;
            case 0xEC: // void
                if (this.dataInterface.peekBytes(this.currentElement.size))
                    this.dataInterface.skipBytes();
                else
                    return null;
                break;
            default:
                console.warn("Global element not found, id: " + this.currentElement.id);
        }


        this.currentElement = null;
        this.segmentIsLoaded = true;
        this.state = STATE_DECODING;
    }

    dequeueAudioPacket(callback) {
        if (this.audioPackets.length) {
            var packet = this.audioPackets.shift().data;
            callback(packet);
        } else {
            callback(null);
        }
    }

    /**
     * Dequeue and return a packet off the video queue
     * @param {function} callback after packet removal complete
     */
    dequeueVideoPacket(callback) {
        if (this.videoPackets.length) {
            var packet = this.videoPackets.shift().data;
            callback(packet);
        } else {
            callback(null);
        }
    }

    /**
     * Clear the current packet buffers and reset the pointers for new read position.
     * Should only need to do this once right before we send a seek request.
     * 
     * Needs to be cleaned up, Don't call so many times
     * @param {function} callback after flush complete
     */
    flush(callback) {
        //nop
        callback();
    }

    _flush() {
        //console.log("flushing demuxer buffer private");
        this.audioPackets = [];
        this.videoPackets = [];
        this.dataInterface.flush();
        //this.tempElementHeader.reset();
        this.currentElement = null;
        this.eof = false;
        //Note: was wrapped in a time function but the callback doesnt seem to take that param
    }

    /**
     * Depreciated, don't use!
     * @param {number} timeSeconds
     * @param {function} callback
     */
    getKeypointOffset(timeSeconds, callback) {
        var offset = this.time(function () {

            return -1; // not used

        }.bind(this));

        callback(offset);
    }

    /*
     * @param {number} timeSeconds seconds to jump to
     * @param {function} callback 
     */
    seekToKeypoint(timeSeconds, callback) {

        var ret = this.time(function () {

            var status;


            this.seekTime = timeSeconds * 1000000000;
            if (this.hasVideo) {
                this.seekTrack = this.videoTrack;
            } else if (this.hasAudio) {
                this.seekTrack = this.audioTrack;
            } else {
                return 0;
            }

            this.state = STATE_SEEKING;
            this._flush();
            if (!this.cuesLoaded)
                this.initCues();



            return 1;

        }.bind(this));
        //doesnt need ret, it always returns 1
        this.audioPackets = [];
        this.videoPackets = [];
        callback(!!ret);
    }

    processSeeking() {
        //Have to load cues if not available
        if (!this.cuesLoaded) {

            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return 0;
            }
            if (!this.cues)
                this.cues = new Cues(this.currentElement, this.dataInterface, this);
            this.cues.load();
            if (!this.cues.loaded)
                return 0;
            this.cuesLoaded = true;
            console.warn("cues loaded");
            //console.log(this.cues);
        }
        //now we can caluclate the pointer offset
        this.calculateKeypointOffset();
        this._flush(); //incase loading cues
        //we should now have the cue point
        var clusterOffset = this.seekCueTarget.cueTrackPositions.cueClusterPosition + this.segment.dataOffset;
        console.log("clusterOffset : " + clusterOffset);
        this.dataInterface.offset = clusterOffset;
        this.onseek(clusterOffset);
        this.state = STATE_DECODING;
        return 0;
    }

    close() {
        //nothing for now
    }

    /**
     * Possibly use this to initialize cues if not loaded, can be called from onScrub or seekTo
     * Send seek request to cues, then make it keep reading bytes and waiting until cues are loaded
     * @returns {undefined}
     */
    initCues() {

        if (!this.cuesOffset) {

            var length = this.seekHead.entries.length;
            var entries = this.seekHead.entries;
            console.warn(this.seekHead);
            var seekOffset;
            //Todo : make this less messy
            for (var i = 0; i < length; i++) {
                if (entries[i].seekId === 0x1C53BB6B) // cues
                    this.cuesOffset = entries[i].seekPosition + this.segment.dataOffset; // its the offset from data offset
            }
        }

        this.dataInterface.flush();
        this._flush();
        this.dataInterface.offset = this.cuesOffset;
        this.loadingCues = true;
        this.onseek(this.cuesOffset);

    }

    /**
     * Get the offset based off the seconds, probably use binary search and have to parse the keypoints to numbers
     */
    calculateKeypointOffset() {
        var r;
        var timecodeScale = this.segmentInfo.timecodeScale;
        this.seekTime;
        var cuesPoints = this.cues.entries; //cache for faster lookups;
        var length = this.cues.entries.length; // total number of cues;
        var scanPoint = cuesPoints[0];
        var tempPoint;


        //do linear search now
        //Todo, make binary search
        var i = 1;
        for (i; i < length; i++) {
            tempPoint = cuesPoints[i];
            if (tempPoint.cueTime * timecodeScale > this.seekTime)
                break;
            scanPoint = tempPoint;
        }

        this.seekCueTarget = scanPoint;
    }

}








module.exports = FlareWebmDemuxer;