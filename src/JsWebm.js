'use strict';

const DataInterface = require('./DataInterface/DataInterface.js');
const SeekHead = require('./SeekHead.js');
const SegmentInfo = require('./SegmentInfo.js');
const Tracks = require('./Tracks.js');
const Cluster = require('./Cluster.js');
const Cues = require('./Cues.js');
const ElementHeader = require('./ElementHeader.js');
const Tags = require('./Tags.js');

//States
const STATE_INITIAL = 0;
const STATE_DECODING = 1;
const STATE_SEEKING = 2;
const META_LOADED = 3;
const STATE_FINISHED = 4;
const EXIT_OK = 666;

let getTimestamp;
if (typeof performance === 'undefined' || typeof performance.now === 'undefined') {
  getTimestamp = Date.now;
} else {
  getTimestamp = performance.now.bind(performance);
}

/**
 * @classdesc Wrapper class to handle webm demuxing
 */
class JsWebm {
  constructor() {
    this.shown = false; // for testin
    this.clusters = [];
    this.segmentInfo = [];
    this.state = STATE_INITIAL;
    this.videoPackets = [];
    this.audioPackets = [];
    this.loadedMetadata = false;
    this.seekable = true;//keep false until seek is finished
    this.dataInterface = new DataInterface(this);
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
    this.videoFormat = null;
    this.audioFormat = null;
    this.videoCodec = null;
    this.audioFormat = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.processing = false;

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

    Object.defineProperty(this, 'nextKeyframeTimestamp', {
      get: function () {

        /*
        for (var i = 0; i < this.videoPackets.length; i++) {
            var packet = this.videoPackets[i];
            if (packet.isKeyframe) {
                console.warn(packet.timestamp);
                return packet.timestamp;
            }
        }*/
        //console.warn(this);
        return -1;
      }
    });

    console.log('%c JSWEBM DEMUXER LOADED', 'background: #F27127; color:  #2a2a2a');
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
   * Sets up the meta data validation after
   */
  validateMetadata() {
    var codecID;
    var channels;
    var rate;
    var tempTrack;
    //Multiple video tracks are allowed, for now just return the first one
    for (var i in this.tracks.trackEntries) {
      var trackEntry = this.tracks.trackEntries[i];
      if (trackEntry.trackType === 2) {
        tempTrack = trackEntry;
        codecID = trackEntry.codecID;
        channels = trackEntry.channels;
        rate = trackEntry.rate;
        break;
      }
    }
    this.audioTrack = tempTrack;
    var codecName;
    switch (codecID) {
      case "A_VORBIS":
        this.audioCodec = "vorbis";
        this.initVorbisHeaders(tempTrack);
        break;
      case "A_OPUS":
        this.audioCodec = "opus";
        this.initOpusHeaders(tempTrack);
        break;
      default:
        this.audioCodec = null;
        break;
    }


    for (var i in this.tracks.trackEntries) {
      var trackEntry = this.tracks.trackEntries[i];
      if (trackEntry.trackType === 1) { // video track
        tempTrack = trackEntry;
        codecID = trackEntry.codecID;
        break;
      }
    }

    switch (codecID) {
      case "V_VP8":
        this.videoCodec = "vp8";
        break;
      case "V_VP8":
        this.videoCodec = "vp9";
        break;
      default:
        this.videoCodec = null;
        break;
    }


    this.videoTrack = tempTrack;
    var fps = 0;//For now?
    this.videoFormat = {
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

    this.loadedMetadata = true;
  }

  initOpusHeaders(trackEntry) {
    this.audioTrack = trackEntry;
  }

  initVorbisHeaders(trackEntry) {
    var headerParser = new DataView(trackEntry.codecPrivate);
    var packetCount = headerParser.getUint8(0);
    var firstLength = headerParser.getUint8(1);
    var secondLength = headerParser.getUint8(2);
    var thirdLength = headerParser.byteLength - firstLength - secondLength - 1;
    if (packetCount !== 2)
      throw "INVALID VORBIS HEADER";
    //throw "last length  = " + thirdLength;
    var start = 3;
    var end = start + firstLength;

    this.audioPackets.push({//This could be improved
      data: headerParser.buffer.slice(start, end),
      timestamp: -1
    });
    start = end;
    end = start + secondLength;

    this.audioPackets.push({//This could be improved
      data: headerParser.buffer.slice(start, end),
      timestamp: -1
    });
    start = end;
    end = start + thirdLength;
    this.audioPackets.push({//This could be improved
      data: headerParser.buffer.slice(start, end),
      timestamp: -1
    });

    //trackEntry.codecPrivate = null; //won't need it anymore
    this.audioTrack = trackEntry;
  }

  /**
   * This function ques up more data to the internal buffer
   * @param {arraybuffer} data
   * @returns {void}
   */
  queueData(data) {
    this.dataInterface.recieveInput(data);
  }

  demux(data) {
    //this.queueData(data);
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
  }

  process(callback) {
    var result;
    //console.warn("Processing at : " + this.dataInterface.offset);
    if (this.dataInterface.currentBuffer === null && this.state !== STATE_SEEKING) {

      console.error("Read with no Buffer " + this.dataInterface.offset);
      //throw("wrong " + this.dataInterface.offset);
      result = 0;
      //console.warn(!!result);
      callback(!!result);
      return;
    }

    //console.warn("Process called");
    var start = getTimestamp();
    var status = false;
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
        console.warn("Seek processing");
        status = this.processSeeking();
        //if (this.state !== META_LOADED)
        break;
      default:
        throw "state got wrecked";
      //fill this out
    }

    //this.processing = false;
    var delta = (getTimestamp() - start);
    this.cpuTime += delta;

    //return status;
    if (status === 1 || status === true) {
      result = 1;
    } else {
      result = 0;
    }

    if (!this.dataInterface.currentBuffer)
      result = 0;
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
          var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
          if (skipped === false)
            return;

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

        case 0x1254c367: //Tags
          if (!this.tags)
            this.tags = new Tags(this.tempElementHeader.getData(), this.dataInterface, this);
          this.tags.load();
          if (!this.tags.loaded)
            return false;
          break;

        case 0x1F43B675: //Cluster
          if (!this.loadedMetadata) {
            this.validateMetadata();
            return true;
          }
          if (!this.currentCluster) {
            this.currentCluster = new Cluster(
              this.tempElementHeader.offset,
              this.tempElementHeader.size,
              this.tempElementHeader.end,
              this.tempElementHeader.dataOffset,
              this.dataInterface,
              this
            );

          }


          status = this.currentCluster.load();
          if (!this.currentCluster.loaded) {
            return status;
          }



          this.currentCluster = null;
          break;



        default:
          this.state = META_LOADED;//testing
          var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
          if (skipped === false)
            return;

          console.log("UNSUPORTED ELEMENT FOUND, SKIPPING : " + this.tempElementHeader.id.toString(16));
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

          case 0xbf: //CRC-32
            var crc = dataInterface.getBinary(this.tempElementHeader.size);
            if (crc !== null)
              crc;
            //this.docTypeReadVersion = docTypeReadVersion;
            else
              return null;
            break;

          default:
            console.warn("UNSUPORTED HEADER ELEMENT FOUND, SKIPPING : " + this.tempElementHeader.id.toString(16));
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
        var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
        if (skipped === false)
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
    if (this.audioPackets.length > 0) {
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
    if (this.videoPackets.length > 0) {
      var packet = this.videoPackets.shift().data;
      //console.warn("dequeing packet size: " + packet.byteLength);
      callback(packet);
    } else {
      callback(null);
    }
  }

  _flush() {
    //console.log("flushing demuxer buffer private");
    this.audioPackets = [];
    this.videoPackets = [];
    this.dataInterface.flush();
    //this.tempElementHeader.reset();
    this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
    this.tempElementHeader.reset();

    this.currentElement = null;
    this.currentCluster = null;
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
    this.state = STATE_SEEKING;
    console.warn("SEEK BEING CALLED");
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
      this.processSeeking();
      return 1;
    }.bind(this));
    this.audioPackets = [];
    this.videoPackets = [];
    callback(!!ret);
  }

  processSeeking() {
    //console.warn("process seek");
    //Have to load cues if not available
    if (!this.cuesLoaded) {
      //throw "cues not loaded";
      if (!this.cuesOffset) {
        this.initCues();
        this._flush();
        this.dataInterface.offset = this.cuesOffset;
        this.onseek(this.cuesOffset);
        return 0;
      }
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null)
          return 0;
      }
      if (!this.cues)
        this.cues = new Cues(this.currentElement, this.dataInterface, this);
      //processing cues
      this.cues.load();
      if (!this.cues.loaded)
        return 0;
      this.cuesLoaded = true;
      //console.warn(this.cues);
      return 0;
    }
    //now we can caluclate the pointer offset
    this.calculateKeypointOffset();
    //we should now have the cue point
    var clusterOffset = this.seekCueTarget.cueTrackPositions.cueClusterPosition + this.segment.dataOffset;
    this._flush();
    this.dataInterface.offset = clusterOffset;
    this.onseek(clusterOffset);
    this.state = STATE_DECODING;
    return 0;
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
      //console.warn(this.seekHead);
      var seekOffset;
      //Todo : make this less messy
      for (var i = 0; i < length; i += 1) {
        if (entries[i].seekId === 0x1C53BB6B) // cues
          this.cuesOffset = entries[i].seekPosition + this.segment.dataOffset; // its the offset from data offset
      }
    }
  }

  /**
   * Get the offset based off the seconds, probably use binary search and have to parse the keypoints to numbers
   */
  calculateKeypointOffset() {
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

module.exports = JsWebm;
