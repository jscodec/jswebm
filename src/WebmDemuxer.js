'use strict';

var DataInterface = require('./DataInterface.js');
var SeekHead = require('./SeekHead.js');
var SegmentInfo = require('./SegmentInfo.js');
var Tracks = require('./Tracks.js');
var Cluster = require('./Cluster.js');
var Cues = require('./Cues.js');
var ElementHeader = require('./ElementHeader.js');

//States
var INITIAL_STATE = 0;
var HEADER_LOADED = 1;
var SEGMENT_LOADED = 2;
var META_LOADED = 3;
var EXIT_OK = 666;


var STATE_BEGIN = 0;
var STATE_DECODING = 1;
var STATE_SEEKING = 4;

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
        this.state = INITIAL_STATE;
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
        console.warn("processing");


        //this.processing = true;

        switch (this.state) {
            case INITIAL_STATE:
                this.loadHeader();
                if (this.state !== HEADER_LOADED)
                    break;
            case HEADER_LOADED:
                this.loadSegment();
                if (this.state !== SEGMENT_LOADED)
                    break;
            case SEGMENT_LOADED:
                status = this.loadMeta();
                if (this.state !== META_LOADED)
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

        //console.info("processing return : " + result);
        callback(!!result);
    }

    /**
     * General process loop, 
     * TODO, refactor this!!!!!
     */
    loadMeta() {
        var status = false;

        while (this.dataInterface.offset < this.segment.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }


            switch (this.currentElement.id) {

                case 0x114D9B74: //Seek Head
                    if (!this.seekHead)
                        this.seekHead = new SeekHead(this.currentElement, this.dataInterface);
                    this.seekHead.load();
                    if (!this.seekHead.loaded)
                        return false;
                    break;

                case 0xEC: //VOid
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);

                    console.log("FOUND VOID, SKIPPING");
                    break;

                case 0x1549A966: //Info
                    if (!this.segmentInfo)
                        this.segmentInfo = new SegmentInfo(this.currentElement, this.dataInterface);
                    this.segmentInfo.load();
                    if (!this.segmentInfo.loaded)
                        return false;
                    break;

                case 0x1654AE6B: //Tracks
                    if (!this.tracks)
                        this.tracks = new Tracks(this.currentElement, this.dataInterface, this);
                    this.tracks.load();
                    if (!this.tracks.loaded)
                        return false;
                    break;

                case 0x1F43B675: //Cluster
                    if (!this.currentCluster) {
                        var metaWasLoaded = this.loadedMetadata;
                        this.currentCluster = new Cluster(this.currentElement, this.dataInterface, this);
                        if (this.loadedMetadata && !metaWasLoaded)
                            return true;
                    }
                    status = this.currentCluster.load();
                    if (!this.currentCluster.loaded) {
                        return status;
                    }

                    //this.clusters.push(this.currentCluster); //TODO: Don't overwrite this, make id's to keep track or something
                    this.currentCluster = null;
                    break;

                case 0x1C53BB6B: //Cues
                    if (!this.cues)
                        this.cues = new Cues(this.currentElement, this.dataInterface, this);
                    this.cues.load();
                    if (!this.cues.loaded)
                        return false;
                    this.cuesLoaded = true;
                    break;

                default:
                    this.state = META_LOADED;//testing
                    return;
                    console.error("body element not found, skipping, id = " + this.currentElement.id);
                    break;

            }

            this.currentElement = null;
        }

        this.state = META_LOADED;
        return status;
    }

    /**
     * finds the beginnign of the segment. Should modify to allow level 0 voids, apparantly they are possible 
     */
    loadSegment() {
        if (this.state !== HEADER_LOADED)
            console.error("HEADER NOT LOADED");

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
        this.state = SEGMENT_LOADED;
    }

    loadHeader() {
        //Header is small so we can read the whole thing in one pass or just wait for more data if necessary


        //only load it if we didnt already load it
        if (!this.elementEBML) {
            this.elementEBML = this.dataInterface.peekElement();
            if (!this.elementEBML)
                return null;

            if (this.elementEBML.id !== 0x1A45DFA3) { //EBML 
                //If the header has not loaded and the first element is not the header, do not continue
                console.warn('INVALID PARSE, HEADER NOT LOCATED');
            }
        }

        while (this.dataInterface.offset < this.elementEBML.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }


            switch (this.currentElement.id) {

                case 0x4286: //EBMLVersion
                    var version = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (version !== null)
                        this.version = version;
                    else
                        return null;
                    break;

                case 0x42F7: //EBMLReadVersion 
                    var readVersion = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (readVersion !== null)
                        this.readVersion = readVersion;
                    else
                        return null;
                    break;

                case 0x42F2: //EBMLMaxIDLength
                    var maxIdLength = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (maxIdLength !== null)
                        this.maxIdLength = maxIdLength;
                    else
                        return null;
                    break;

                case 0x42F3: //EBMLMaxSizeLength
                    var maxSizeLength = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (maxSizeLength !== null)
                        this.maxSizeLength = maxSizeLength;
                    else
                        return null;
                    break;

                case 0x4282: //DocType
                    var docType = this.dataInterface.readString(this.currentElement.size);
                    if (docType !== null)
                        this.docType = docType;
                    else
                        return null;
                    break;

                case 0x4287: //DocTypeVersion //worked
                    var docTypeVersion = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (docTypeVersion !== null)
                        this.docTypeVersion = docTypeVersion;
                    else
                        return null;
                    break;

                case 0x4285: //DocTypeReadVersion //worked
                    var docTypeReadVersion = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (docTypeReadVersion !== null)
                        this.docTypeReadVersion = docTypeReadVersion;
                    else
                        return null;
                    break;
                default:
                    console.warn("Header element not found, skipping");
                    break;

            }

            this.currentElement = null;
        }

        this.headerIsLoaded = true;
        this.state = HEADER_LOADED;
    }

    dequeueAudioPacket(callback) {
        //console.warn("Dequeing audio");

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
        //console.warn(this);
        //throw "STOP";
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
        //console.log("flushing demuxer buffer");
        //this.audioPackets = [];
        //this.videoPackets = [];
        //this.dataInterface.flush();
        //this.currentElement = null;
        //Note: was wrapped in a time function but the callback doesnt seem to take that param

        //console.log(this);
        //throw "TEST";
        callback();
    }
    
    _flush() {
        //console.log("flushing demuxer buffer private");
        this.audioPackets = [];
        this.videoPackets = [];
        this.dataInterface.flush();
        this.currentElement = null;
        //Note: was wrapped in a time function but the callback doesnt seem to take that param

        //console.log(this);
        //throw "TEST";
 
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
            
            
            this.seekTime = timeSeconds * 1000000;
            if (this.hasVideo) {
                this.seekTrack = this.videoTrack;
            } else if (this.hasAudio) {
                this.seekTrack = this.audioTrack;
            } else {
                return 0;
            }
            /*
            if (this.state === STATE_SEEKING) {
                status = this.processSeeking();
            } else {
                
            }
            */
            this.state = STATE_SEEKING;
            this._flush();
            if(!this.cuesLoaded)
                this.initCues();
 
            //this.processSeeking();

            return 1;

        }.bind(this));
        //doesnt need ret, it always returns 1
        this.audioPackets = [];
        this.videoPackets = [];
        //console.warn("seektime is " + timeSeconds);
        //console.warn("seektime saved is " + this.seekTime);
        //this.currentElement = null;
	

        callback(!!ret);
    }
    
    processSeeking() {
        //console.warn("Processing seek , cues offset = " + this.seekTime);
        
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
            console.log(this.cues);
        }
        //now we can caluclate the pointer offset
        this.calculateKeypointOffset();
        this._flush(); //incase loading cues
        //we should now have the cue point
        console.warn("target");
        this.seekCueTarget;
        var clusterOffset =  this.seekCueTarget.cueTrackPositions.cueClusterPosition + this.segment.dataOffset;
        console.log("clusterOffset : " + clusterOffset);
        var relativePosition = 4467;//clusterOffset + this.seekCueTarget.cueTrackPositions.cueRelativePosition;
        
        this.currentElement = new ElementHeader(0x1F43B675 , -1 , clusterOffset, -1);
        this.currentCluster = new Cluster(this.currentElement, this.dataInterface, this);
        
        
        this.dataInterface.offset = relativePosition;
        this.onseek(relativePosition);
        this.state = SEGMENT_LOADED;
        return 0;
        
  
                        

        /*
    this.dataInterface.lastSeekTarget = 0;
        
        var r = this.calculateKeypointOffset();
        if (r) {
            if (this.dataInterface.lastSeekTarget === 0) {
                // Maybe we just need more data?
                console.log("is seeking processing... FAILED ");
            } else{
                this.target = this.dataInterface.lastSeekTarget;
                this.dataInterface.offset = target;
                //this.seekFinish(target);
            }
        } else{
            this.state = STATE_DECODING;
            //console.log("is seeking processing... LOOKS ROLL OVER\n");
            return 1;
        }
                                                                                                                    */
    }
    
    
    seekFinish(offsetLow, offsetHigh) {
        var offset = offsetLow + offsetHigh * 0x100000000;
        if (this.onseek) {
            this.onseek(offset);
        }
    }


    
    close(){
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
        console.warn("seektime saved is " + this.seekTime);

        var r;
        //struct cue_point * cue_point;
        //struct cue_track_positions * pos;
        //uint64_t seek_pos, tc_scale;
        var timecodeScale = this.segmentInfo.timecodeScale;
        this.seekTime;
        var cuesPoints = this.cues.entries; //cache for faster lookups;
        var length = this.cues.entries.length; // total number of cues;
        var scanPoint;
        
        
        //do linear search now
        //Todo, make binary search
        for (var i = 0; i < length ; i++){
            scanPoint = cuesPoints[i];
            if(scanPoint.cueTime * timecodeScale > this.seekTime)
                break;
        }
        
        this.seekCueTarget = scanPoint;
        
        
        
        /*
  tc_scale = ne_get_timecode_scale(ctx);

  cue_point = ne_find_cue_point_for_tstamp(ctx, ctx->segment.cues.cue_point.head,
                                           track, tc_scale, tstamp);
  if (!cue_point)
    return -1;

  pos = ne_find_cue_position_for_track(ctx, cue_point->cue_track_positions.head, track);
  if (pos == NULL)
    return -1;

  if (ne_get_uint(pos->cluster_position, &seek_pos) != 0)
    return -1;

  // Seek to (we assume) the start of a Cluster element. 
  r = nestegg_offset_seek(ctx, ctx->segment_offset + seek_pos);
  if (r != 0)
    return -1;

  return 0;
         */
}

}








module.exports = FlareWebmDemuxer;
