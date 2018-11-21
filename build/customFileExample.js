/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	const JsWebm = __webpack_require__(2);
	const CircularJSON = __webpack_require__(22);

	const fileRequest = new XMLHttpRequest();



	fileRequest.open("GET", "./test/clock.webm", true);
	fileRequest.responseType = "arraybuffer";

	const runTest = (buffer) => {
	  const demuxer = new JsWebm();
	  demuxer.queueData(buffer);
	  while (!demuxer.eof) {
	    demuxer.demux();
	  }
	  console.log(demuxer);
	  console.log(`total video packets : ${demuxer.videoPackets.length}`);
	  console.log(`total audio packets : ${demuxer.audioPackets.length}`);
	  document.getElementById('output').innerHTML = CircularJSON.stringify(demuxer, null, 2);
	};

	fileRequest.onload = (event) => {
	  const arrayBuffer = fileRequest.response;
	  if (arrayBuffer) {
	    runTest(arrayBuffer);
	  }
	};

	fileRequest.send(null);

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	const DataInterface = __webpack_require__(3);
	const SeekHead = __webpack_require__(6);
	const SegmentInfo = __webpack_require__(8);
	const Tracks = __webpack_require__(9);
	const Cluster = __webpack_require__(13);
	const Cues = __webpack_require__(16);
	const ElementHeader = __webpack_require__(4);
	const Tags = __webpack_require__(18);

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


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	var INITIAL_COUNTER = -1;

	const ElementHeader = __webpack_require__(4);
	const DateParser = __webpack_require__(5);

	class DataInterface {
	  constructor(demuxer) {
	    this.demuxer = demuxer;
	    this.overallPointer = 0;
	    this.internalPointer = 0;
	    this.currentBuffer = null;
	    this.markerPointer = 0;
	    this.tempFloat64 = new DataView(new ArrayBuffer(8));
	    this.tempFloat32 = new DataView(new ArrayBuffer(4));
	    this.tempBinaryBuffer = null;
	    this.seekTarget;
	    this.dateParser = new DateParser();

	    Object.defineProperty(this, 'offset', {
	      get: function () {
	        return this.overallPointer;
	      },

	      set: function (offset) {
	        this.overallPointer = offset;
	      }
	    });
	    this.tempElementOffset = null;
	    this.tempElementDataOffset = null;
	    this.tempSize = null;
	    this.tempOctetWidth = null;
	    this.tempOctet = null;
	    this.tempByteBuffer = 0;
	    this.tempByteCounter = 0;
	    this.tempElementId = null;
	    this.tempElementSize = null;
	    this.tempVintWidth = null;
	    this.tempResult = null;
	    this.tempCounter = INITIAL_COUNTER;
	    this.usingBufferedRead = false;
	    this.dataBuffers = [];

	    /**
	     * Returns the bytes left in the current buffer
	     */
	    Object.defineProperty(this, 'remainingBytes', {
	      get: function () {
	        if (!this.currentBuffer)
	          return 0;
	        else
	          return this.currentBuffer.byteLength - this.internalPointer;
	      }
	    });
	  }

	  flush() {
	    this.currentBuffer = null;
	    this.tempElementOffset = null;
	    this.tempElementDataOffset = null;
	    this.tempSize = null;
	    this.tempOctetWidth = null;
	    this.tempOctet = null;
	    this.tempByteBuffer = 0;
	    this.tempByteCounter = 0;
	    this.tempElementId = null;
	    this.tempElementSize = null;
	    this.tempVintWidth = null;
	    this.tempBinaryBuffer = null;
	    this.tempResult = null;
	    this.tempCounter = INITIAL_COUNTER;
	    this.usingBufferedRead = false;
	    this.overallPointer = 0;
	    this.internalPointer = 0;
	    this.tempFloat64 = new DataView(new ArrayBuffer(8));
	    this.tempFloat32 = new DataView(new ArrayBuffer(4));
	  }

	  recieveInput(data) {
	    if (this.currentBuffer === null) {
	      this.currentBuffer = new DataView(data);
	      this.internalPointer = 0;
	    } else {
	      //queue it for later
	      this.dataBuffers.push(new DataView(data));
	    }
	  }

	  popBuffer() {
	    if (this.remainingBytes === 0) {
	      if (this.dataBuffers.length > 0) {
	        this.currentBuffer = this.dataBuffers.shift();
	      } else {
	        this.currentBuffer = null;
	      }
	      this.internalPointer = 0;
	    }
	  }

	  readDate(size) {
	    return this.readSignedInt(size);
	  }

	  readId() {
	    if (!this.currentBuffer)
	      return null; //Nothing to parse
	    if (!this.tempOctet) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      this.tempElementOffset = this.overallPointer; // Save the element offset
	      this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
	      this.incrementPointers(1);
	      this.tempOctetWidth = this.calculateOctetWidth();
	      this.popBuffer();
	    }

	    //We will have at least one byte to read
	    var tempByte;
	    if (!this.tempByteCounter)
	      this.tempByteCounter = 0;

	    while (this.tempByteCounter < this.tempOctetWidth) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse 
	      if (this.tempByteCounter === 0) {
	        this.tempByteBuffer = this.tempOctet;
	      } else {
	        tempByte = this.readByte();
	        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
	      }

	      this.tempByteCounter++;
	      this.popBuffer();
	    }

	    var result = this.tempByteBuffer;
	    this.tempOctet = null;
	    this.tempByteCounter = null;
	    this.tempByteBuffer = null;
	    this.tempOctetWidth = null;
	    return result;
	  }

	  readLacingSize() {
	    var vint = this.readVint();
	    if (vint === null) {
	      return null;
	    } else {
	      switch (this.lastOctetWidth) {
	        case 1:
	          vint -= 63;
	          break;
	        case 2:
	          vint -= 8191;
	          break;
	        case 3:
	          vint -= 1048575;
	          break;
	        case 4:
	          vint -= 134217727;
	          break;
	      }
	    }
	    return vint;
	  }

	  readVint() {
	    if (!this.currentBuffer)
	      return null; //Nothing to parse
	    if (!this.tempOctet) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
	      this.incrementPointers(1);
	      this.tempOctetWidth = this.calculateOctetWidth();
	      this.popBuffer();
	    }

	    if (!this.tempByteCounter)
	      this.tempByteCounter = 0;
	    var tempByte;
	    var tempOctetWidth = this.tempOctetWidth;
	    while (this.tempByteCounter < tempOctetWidth) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      if (this.tempByteCounter === 0) {
	        var mask = ((0xFF << tempOctetWidth) & 0xFF) >> tempOctetWidth;
	        this.tempByteBuffer = this.tempOctet & mask;
	      } else {
	        tempByte = this.readByte();
	        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
	      }
	      this.tempByteCounter++;
	      this.popBuffer();
	    }

	    var result = this.tempByteBuffer;
	    this.tempOctet = null;
	    this.lastOctetWidth = this.tempOctetWidth;
	    this.tempOctetWidth = null;
	    this.tempByteCounter = null;
	    this.tempByteBuffer = null;
	    //console.warn("read vint");
	    return result;
	  }

	  /**
	   * Use this function to read a vint with more overhead by saving the state on each step
	   * @returns {number | null}
	   */
	  bufferedReadVint() {
	    //We will have at least one byte to read
	    var tempByte;
	    if (!this.tempByteCounter)
	      this.tempByteCounter = 0;
	    while (this.tempByteCounter < this.tempOctetWidth) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      if (this.tempByteCounter === 0) {
	        var mask = ((0xFF << this.tempOctetWidth) & 0xFF) >> this.tempOctetWidth;
	        this.tempByteBuffer = this.tempOctet & mask;
	      } else {
	        tempByte = this.readByte();
	        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
	      }
	      this.tempByteCounter++;
	      this.popBuffer();
	    }
	    var result = this.tempByteBuffer;
	    this.tempByteCounter = null;
	    this.tempByteBuffer = null;
	    return result;
	  }

	  clearTemps() {
	    this.tempId = null;
	    this.tempSize = null;
	    this.tempOctetMask = null;
	    this.tempOctetWidth = null;
	    this.tempOctet = null;
	    this.tempByteBuffer = 0;
	    this.tempByteCounter = 0;
	    this.usingBufferedRead = false;
	  }

	  /**
	   * Use this function to implement a more efficient vint reading if there are enough bytes in the buffer
	   * @returns {Number|null} 
	   */
	  forceReadVint() {
	    var result;
	    switch (this.tempOctetWidth) {
	      case 1:
	        result = this.tempOctet & 0x7F;
	        break;
	      case 2:
	        result = this.tempOctet & 0x3F;
	        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
	        this.incrementPointers(1);
	        break;
	      case 3:
	        result = this.tempOctet & 0x1F;
	        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
	        this.incrementPointers(2);
	        break;
	      case 4:
	        result = this.tempOctet & 0x0F;
	        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
	        this.incrementPointers(2);
	        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
	        this.incrementPointers(1);
	        break;
	      case 5:
	        console.warn("finish this");
	        break;
	      case 6:
	        /* fix this */
	        console.warn("finish this");
	        break;
	      case 7:
	        /* fix this */
	        console.warn("finish this");
	        break;
	      case 8:
	        result = this.tempOctet & 0x00;
	        //Largest allowable integer in javascript is 2^53-1 so gonna have to use one less bit for now
	        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
	        this.incrementPointers(1);
	        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
	        this.incrementPointers(2);
	        result = (result << 32) | this.currentBuffer.getUint32(this.internalPointer);
	        this.incrementPointers(4);
	        break;
	    }

	    this.popBuffer();
	    this.tempOctetWidth = null;
	    this.tempOctet = null;
	    return result;
	  }


	  readByte() {
	    if (!this.currentBuffer) {
	      console.error("READING OUT OF BOUNDS");
	    }
	    var byteToRead = this.currentBuffer.getUint8(this.internalPointer);
	    this.incrementPointers(1);
	    this.popBuffer();
	    //console.warn("read byte");
	    return byteToRead;
	  }

	  readSignedByte() {
	    if (!this.currentBuffer)
	      console.error('READING OUT OF BOUNDS');
	    var byteToRead = this.currentBuffer.getInt8(this.internalPointer);
	    this.incrementPointers(1);
	    this.popBuffer();
	    //console.warn("read signed byte");
	    return byteToRead;
	  }

	  peekElement() {
	    if (!this.currentBuffer)
	      return null; //Nothing to parse
	    //check if we return an id
	    if (!this.tempElementId) {
	      this.tempElementId = this.readId();
	      if (this.tempElementId === null)
	        return null;
	    }

	    if (!this.tempElementSize) {
	      this.tempElementSize = this.readVint();
	      if (this.tempElementSize === null)
	        return null;
	    }
	    var element = new ElementHeader(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);

	    //clear the temp holders
	    this.tempElementId = null;
	    this.tempElementSize = null;
	    this.tempElementOffset = null;
	    return element;
	  }

	  /**
	   * sets the information on an existing element without creating a new objec
	   */
	  peekAndSetElement(element) {
	    if (!this.currentBuffer)
	      return null; //Nothing to parse
	    //check if we return an id
	    if (!this.tempElementId) {
	      this.tempElementId = this.readId();
	      if (this.tempElementId === null)
	        return null;
	    }

	    if (!this.tempElementSize) {
	      this.tempElementSize = this.readVint();
	      if (this.tempElementSize === null)
	        return null;
	    }
	    element.init(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);
	    //clear the temp holders
	    this.tempElementId = null;
	    this.tempElementSize = null;
	    this.tempElementOffset = null;
	  }

	  /*
	   * Check if we have enough bytes available in the buffer to read
	   * @param {number} n test if we have this many bytes available to read
	   * @returns {boolean} has enough bytes to read
	   */
	  peekBytes(n) {
	    if ((this.remainingBytes - n) >= 0)
	      return true;
	    return false;
	  }

	  /**
	   * Skips set amount of bytes
	   * TODO: Make this more efficient with skipping over different buffers, add stricter checking
	   * @param {number} bytesToSkip
	   */
	  skipBytes(bytesToSkip) {
	    var chunkToErase = 0;
	    var counter = 0;
	    if (this.tempCounter === INITIAL_COUNTER)
	      this.tempCounter = 0;
	    while (this.tempCounter < bytesToSkip) {
	      if (!this.currentBuffer)
	        return false;
	      if ((bytesToSkip - this.tempCounter) > this.remainingBytes) {
	        chunkToErase = this.remainingBytes;
	      } else {
	        chunkToErase = bytesToSkip - this.tempCounter;
	      }
	      this.incrementPointers(chunkToErase);
	      this.popBuffer();
	      this.tempCounter += chunkToErase;
	    }
	    this.tempCounter = INITIAL_COUNTER;
	    return true;
	  }

	  getRemainingBytes() {
	    if (!this.currentBuffer)
	      return 0;
	    return this.currentBuffer.byteLength - this.internalPointer;
	  }

	  calculateOctetWidth() {
	    var leadingZeroes = 0;
	    var zeroMask = 0x80;
	    do {
	      if (this.tempOctet & zeroMask)
	        break;

	      zeroMask = zeroMask >> 1;
	      leadingZeroes++;

	    } while (leadingZeroes < 8);
	    //Set the width of the octet
	    return leadingZeroes + 1;
	  }

	  incrementPointers(n) {
	    var bytesToAdd = n || 1;
	    this.internalPointer += bytesToAdd;
	    this.overallPointer += bytesToAdd;
	    //this.popBuffer();
	  }

	  readUnsignedInt(size) {
	    if (!this.currentBuffer)// if we run out of data return null
	      return null; //Nothing to parse
	    //need to fix overflow for 64bit unsigned int
	    if (size <= 0 || size > 8) {
	      console.warn("invalid file size");
	    }
	    if (this.tempResult === null)
	      this.tempResult = 0;
	    if (this.tempCounter === INITIAL_COUNTER)
	      this.tempCounter = 0;
	    var b;
	    while (this.tempCounter < size) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      b = this.readByte();
	      if (this.tempCounter === 0 && b < 0) {
	        console.warn("invalid integer value");
	      }
	      this.tempResult <<= 8;
	      this.tempResult |= b;
	      this.popBuffer();
	      this.tempCounter++;
	    }

	    //clear the temp resut
	    var result = this.tempResult;
	    this.tempResult = null;
	    this.tempCounter = INITIAL_COUNTER;
	    //console.warn("read u int");
	    return result;
	  }

	  readSignedInt(size) {
	    if (!this.currentBuffer)// if we run out of data return null
	      return null; //Nothing to parse
	    //need to fix overflow for 64bit unsigned int
	    if (size <= 0 || size > 8) {
	      console.warn("invalid file size");
	    }
	    if (this.tempResult === null)
	      this.tempResult = 0;
	    if (this.tempCounter === INITIAL_COUNTER)
	      this.tempCounter = 0;
	    var b;
	    while (this.tempCounter < size) {
	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse
	      if (this.tempCounter === 0)
	        b = this.readByte();
	      else
	        b = this.readSignedByte();

	      this.tempResult <<= 8;
	      this.tempResult |= b;
	      this.popBuffer();
	      this.tempCounter++;
	    }

	    //clear the temp resut
	    var result = this.tempResult;
	    this.tempResult = null;
	    this.tempCounter = INITIAL_COUNTER;
	    //console.warn("read s int");
	    return result;
	  }

	  readString(size) {
	    //console.log("reading string");
	    if (!this.tempString)
	      this.tempString = '';

	    if (this.tempCounter === INITIAL_COUNTER)
	      this.tempCounter = 0;

	    var tempString = '';
	    while (this.tempCounter < size) {

	      if (!this.currentBuffer) {// if we run out of data return null
	        //save progress
	        this.tempString += tempString;
	        return null; //Nothing to parse
	      }

	      //this.tempString += String.fromCharCode(this.readByte());
	      tempString += String.fromCharCode(this.readByte());

	      this.popBuffer();

	      this.tempCounter++;
	    }

	    //var tempString = this.tempString;

	    this.tempString += tempString;
	    var retString = this.tempString;
	    this.tempString = null;
	    this.tempCounter = INITIAL_COUNTER;
	    return retString;
	  }

	  readFloat(size) {
	    if (size === 8) {


	      if (this.tempCounter === INITIAL_COUNTER)
	        this.tempCounter = 0;

	      if (this.tempResult === null) {
	        this.tempResult = 0;
	        this.tempFloat64.setFloat64(0, 0);
	      }


	      var b;

	      while (this.tempCounter < size) {

	        if (!this.currentBuffer)// if we run out of data return null
	          return null; //Nothing to parse



	        b = this.readByte();

	        this.tempFloat64.setUint8(this.tempCounter, b);

	        this.popBuffer();

	        this.tempCounter++;
	      }

	      this.tempResult = this.tempFloat64.getFloat64(0);


	    } else if (size === 4) {

	      if (this.tempCounter === INITIAL_COUNTER)
	        this.tempCounter = 0;

	      if (this.tempResult === null) {
	        this.tempResult = 0;
	        this.tempFloat32.setFloat32(0, 0);
	      }


	      var b;

	      while (this.tempCounter < size) {

	        if (!this.currentBuffer)// if we run out of data return null
	          return null; //Nothing to parse



	        b = this.readByte();

	        this.tempFloat32.setUint8(this.tempCounter, b);

	        this.popBuffer();

	        this.tempCounter++;
	      }

	      this.tempResult = this.tempFloat32.getFloat32(0);

	    } else {
	      throw "INVALID FLOAT LENGTH";
	    }

	    //clear the temp resut
	    var result = this.tempResult;
	    this.tempResult = null;
	    this.tempCounter = INITIAL_COUNTER;
	    return result;
	  }

	  /**
	   * Returns a new buffer with the length of data starting at the current byte buffer
	   * @param {number} length Length of bytes to read
	   * @returns {ArrayBuffer} the read data
	   */
	  getBinary(length) {


	    if (!this.currentBuffer)// if we run out of data return null
	      return null; //Nothing to parse
	    //
	    //console.warn("start binary");
	    if (this.usingBufferedRead && this.tempCounter === null) {
	      throw "COUNTER WAS ERASED";
	    }

	    //Entire element contained in 1 array
	    if (this.remainingBytes >= length && !this.usingBufferedRead) {

	      if (!this.currentBuffer)// if we run out of data return null
	        return null; //Nothing to parse

	      var newBuffer = this.currentBuffer.buffer.slice(this.internalPointer, this.internalPointer + length);

	      this.incrementPointers(length);
	      this.popBuffer();
	      return newBuffer;

	    }


	    var test = this.offset;
	    var tempRemainingBytes = this.remainingBytes;

	    if (this.usingBufferedRead === false && this.tempCounter > 0)
	      throw "INVALID BUFFERED READ";//at this point should be true

	    //data is broken up across different arrays
	    //TODO: VERY SLOW, FIX THIS!!!!!!!!!!
	    this.usingBufferedRead = true;

	    //console.error("USING BUFFERED READ");

	    if (!this.tempBinaryBuffer)
	      this.tempBinaryBuffer = new Uint8Array(length);

	    if (this.tempCounter === INITIAL_COUNTER)
	      this.tempCounter = 0;

	    var bytesToCopy = 0;
	    var tempBuffer;
	    while (this.tempCounter < length) {

	      if (!this.currentBuffer) {// if we run out of data return null{
	        if (this.usingBufferedRead === false)
	          throw "HELLA WRONG";
	        return null; //Nothing to parse
	      }


	      if ((length - this.tempCounter) >= this.remainingBytes) {
	        bytesToCopy = this.remainingBytes;
	      } else {
	        bytesToCopy = length - this.tempCounter;
	      }

	      tempBuffer = new Uint8Array(this.currentBuffer.buffer, this.internalPointer, bytesToCopy);
	      this.tempBinaryBuffer.set(tempBuffer, this.tempCounter);
	      this.incrementPointers(bytesToCopy);
	      //b = this.readByte();

	      //this.tempBinaryBuffer.setUint8(this.tempCounter, b);



	      this.popBuffer();


	      this.tempCounter += bytesToCopy;
	    }


	    if (this.tempCounter !== length)
	      console.warn("invalid read");
	    var tempBinaryBuffer = this.tempBinaryBuffer;
	    this.tempBinaryBuffer = null;
	    this.tempCounter = INITIAL_COUNTER;
	    this.usingBufferedRead = false;

	    //console.warn("reading binary");
	    if (tempBinaryBuffer.buffer === null) {
	      throw "Missing buffer";
	    }
	    return tempBinaryBuffer.buffer;


	  }



	}




	module.exports = DataInterface;

/***/ }),
/* 4 */
/***/ (function(module, exports) {

	/**
	 * @classdesc A class to handle managment of matroska elements
	 */
	class ElementHeader {
	  /**
	   * 
	   * @param {number} id the element id
	   * @param {number} size the size of the payload
	   * @param {number} offset the offset in the file
	   * @param {number} dataOffset the offset of the payload
	   */
	  constructor(id, size, offset, dataOffset) {
	    this.id = id;
	    this.size = size;
	    //this.headerSize;
	    this.offset = offset;
	    this.dataOffset = dataOffset;
	    this.end = dataOffset + size;
	    this.status = true;
	  }

	  init(id, size, offset, dataOffset) {
	    this.id = id;
	    this.size = size;
	    //this.headerSize;
	    this.offset = offset;
	    this.dataOffset = dataOffset;
	    this.end = dataOffset + size;
	    this.status = true;
	  }

	  reset() {
	    this.status = false;
	  }

	  getData() {
	    return {
	      id: this.id,
	      size: this.size,
	      offset: this.offset,
	      dataOffset: this.dataOffset,
	      end: this.end
	    };
	  }
	}

	module.exports = ElementHeader;


/***/ }),
/* 5 */
/***/ (function(module, exports) {

	'use strict';

	class DateParser {

	  constructor() {

	  }

	}

	module.exports = DateParser;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

	const Seek = __webpack_require__(7);

	class SeekHead {
	  constructor(seekHeadHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = seekHeadHeader.offset;
	    this.size = seekHeadHeader.size;
	    this.end = seekHeadHeader.end;
	    this.entries = [];
	    this.entryCount = 0;
	    this.voidElements = [];
	    this.voidElementCount = 0;
	    this.loaded = false;
	    this.tempEntry = null;
	    this.currentElement = null;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }


	      switch (this.currentElement.id) {

	        case 0x4DBB: //Seek
	          if (!this.tempEntry)
	            this.tempEntry = new Seek(this.currentElement, this.dataInterface);
	          this.tempEntry.load();
	          if (!this.tempEntry.loaded)
	            return;
	          else
	            this.entries.push(this.tempEntry);
	          break;

	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;

	        //TODO, ADD VOID
	        default:
	          console.warn("Seek head element not found, skipping : " + this.currentElement.id.toString(16));
	          break;

	      }

	      this.tempEntry = null;
	      this.currentElement = null;
	    }


	    if (this.dataInterface.offset !== this.end) {
	      console.log(this);
	      throw "INVALID SEEKHEAD FORMATTING"
	    }


	    this.loaded = true;
	  }

	}


	module.exports = SeekHead;

/***/ }),
/* 7 */
/***/ (function(module, exports) {

	class Seek {
	  constructor(seekHeader, dataInterface) {
	    this.size = seekHeader.size;
	    this.offset = seekHeader.offset;
	    this.end = seekHeader.end;
	    this.dataInterface = dataInterface;
	    this.loaded = false;
	    this.currentElement = null;
	    this.seekId = -1;
	    this.seekPosition = -1;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }

	      switch (this.currentElement.id) {
	        case 0x53AB: //SeekId
	          var seekId = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (seekId !== null)
	            this.seekId = seekId;
	          else
	            return null;
	          break;
	        case 0x53AC: //SeekPosition 
	          var seekPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (seekPosition !== null)
	            this.seekPosition = seekPosition;
	          else
	            return null;
	          break;
	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        default:
	          console.warn("Seek element not found, skipping : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }
	    if (this.dataInterface.offset !== this.end)
	      console.error("Invalid Seek Formatting");
	    this.loaded = true;
	  }
	}

	module.exports = Seek;


/***/ }),
/* 8 */
/***/ (function(module, exports) {

	class SegmentInfo {
	  constructor(infoHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = infoHeader.offset;
	    this.size = infoHeader.size;
	    this.end = infoHeader.end;
	    this.muxingApp = null;
	    this.writingApp = null;
	    this.title = null;
	    this.dataOffset = null;
	    this.timecodeScale = 1000000;
	    this.duration = -1;
	    this.loaded = false;
	    this.segmentUID = null;
	    this.duration = null;
	    this.dateUTC;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }

	      switch (this.currentElement.id) {
	        //TODO add duration and title
	        case 0x2AD7B1: //TimeCodeScale
	          var timecodeScale = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (timecodeScale !== null)
	            this.timecodeScale = timecodeScale;
	          else
	            return null;
	          break;

	        case 0x4D80: //Muxing App 
	          var muxingApp = this.dataInterface.readString(this.currentElement.size);
	          if (muxingApp !== null)
	            this.muxingApp = muxingApp;
	          else
	            return null;
	          break;
	        case 0x5741: //writing App 
	          var writingApp = this.dataInterface.readString(this.currentElement.size);
	          if (writingApp !== null)
	            this.writingApp = writingApp;
	          else
	            return null;
	          break;

	        case 0x7BA9: //title
	          var title = this.dataInterface.readString(this.currentElement.size);
	          if (title !== null)
	            this.title = title;
	          else
	            return null;
	          break;
	        case 0x73A4: //segmentUID
	          //TODO, LOAD THIS AS A BINARY ARRAY, SHOULD BE 128 BIT UNIQUE ID
	          var segmentUID = this.dataInterface.readString(this.currentElement.size);
	          if (segmentUID !== null)
	            this.segmentUID = segmentUID;
	          else
	            return null;
	          break;

	        case 0x4489: //duration
	          var duration = this.dataInterface.readFloat(this.currentElement.size);
	          if (duration !== null)
	            this.duration = duration;
	          else
	            return null;
	          break;

	        case 0x4461: //DateUTC
	          var dateUTC = this.dataInterface.readDate(this.currentElement.size);
	          if (dateUTC !== null)
	            this.dateUTC = dateUTC;
	          else
	            return null;
	          break;

	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        default:
	          console.error("Ifno element not found, skipping : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }

	    if (this.dataInterface.offset !== this.end)
	      console.error("Invalid SegmentInfo Formatting");


	    this.loaded = true;
	  }

	}

	module.exports = SegmentInfo;

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	const Seek = __webpack_require__(7);
	const AudioTrack = __webpack_require__(10);
	const VideoTrack = __webpack_require__(12);

	class Tracks {
	  constructor(seekHeadHeader, dataInterface, demuxer) {
	    this.demuxer = demuxer;
	    this.dataInterface = dataInterface;
	    this.offset = seekHeadHeader.offset;
	    this.size = seekHeadHeader.size;
	    this.end = seekHeadHeader.end;
	    this.trackEntries = [];
	    this.loaded = false;
	    this.tempEntry = null;
	    this.currentElement = null;
	    this.trackLoader = new TrackLoader();
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0xAE: //Track Entry
	          if (!this.trackLoader.loading)
	            this.trackLoader.init(this.currentElement, this.dataInterface);
	          this.trackLoader.load();
	          if (!this.trackLoader.loaded)
	            return;
	          else
	            var trackEntry = this.trackLoader.getTrackEntry();
	          this.trackEntries.push(trackEntry);
	          break;
	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        default:
	          console.warn("track element not found, skipping : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }

	    this.loaded = true;
	  }

	  loadTrackEntry() {
	    if (!this.tempEntry) {
	      this.tempEntry = new Seek(this.currentElement, this.dataInterface);
	    }
	  }
	}

	/**
	 * @classdesc The TrackLoader class is a helper class to load the Track subelement types. Since the layout
	 * of the Track entries is a little odd, it needs to parse the current 
	 * level data plus the track container which can be either audio video, content encodings, and maybe subtitles.
	 */
	class TrackLoader {
	  constructor() {
	    this.dataInterface = null;
	    this.offset = null;
	    this.size = null;
	    this.end = null;
	    this.loaded = false;
	    this.loading = false;
	    this.trackData = {};
	    this.trackData.trackNumber = null;
	    this.trackData.trackType = null;
	    this.trackData.name = null;
	    this.trackData.codecName = null;
	    this.trackData.defaultDuration = null;
	    this.trackData.codecID = null;
	    this.trackData.lacing = null;
	    this.trackData.codecPrivate = null;
	    this.trackData.codecDelay = null;
	    this.trackData.seekPreRoll = null;
	    this.tempTrack = null;
	    this.minCache = null;
	  }

	  init(trackheader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = trackheader.offset;
	    this.size = trackheader.size;
	    this.end = trackheader.end;
	    this.loaded = false;
	    this.loading = true;
	    this.trackData.trackNumber = null;
	    this.trackData.trackType = null;
	    this.trackData.name = null;
	    this.trackData.codecName = null;
	    this.trackData.defaultDuration = null;
	    this.trackData.codecID = null;
	    this.trackData.lacing = null;
	    this.trackData.codecPrivate = null;
	    this.trackData.codecDelay = null;
	    this.trackData.seekPreRoll = null;
	    this.trackData.trackUID = null;
	    this.tempTrack = null;
	    this.minCache = null;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null) return null;
	      }
	      switch (this.currentElement.id) {
	        //TODO support content encodings
	        case 0xE0: //Video Track
	          if (!this.tempTrack)
	            this.tempTrack = new VideoTrack(this.currentElement, this.dataInterface);
	          this.tempTrack.load();
	          if (!this.tempTrack.loaded) return;
	          break;
	        case 0xE1: //Audio Number
	          if (!this.tempTrack)
	            this.tempTrack = new AudioTrack(this.currentElement, this.dataInterface);
	          this.tempTrack.load();
	          if (!this.tempTrack.loaded) return;
	          break;
	        case 0xD7: //Track Number
	          var trackNumber = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (trackNumber !== null)
	            this.trackData.trackNumber = trackNumber;
	          else
	            return null;
	          break;
	        case 0x83: //TrackType 
	          var trackType = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (trackType !== null)
	            this.trackData.trackType = trackType;
	          else
	            return null;
	          break;
	        case 0x536E: //Name
	          var name = this.dataInterface.readString(this.currentElement.size);
	          if (name !== null)
	            this.trackData.name = name;
	          else
	            return null;
	          break;
	        case 0x258688: //CodecName
	          var codecName = this.dataInterface.readString(this.currentElement.size);
	          if (codecName !== null)
	            this.trackData.codecName = codecName;
	          else
	            return null;
	          break;
	        case 0x22B59C: //Language
	          var language = this.dataInterface.readString(this.currentElement.size);
	          if (language !== null)
	            this.trackData.language = language;
	          else
	            return null;
	          break;
	        case 0x23E383: //DefaultDuration 
	          var defaultDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (defaultDuration !== null)
	            this.trackData.defaultDuration = defaultDuration;
	          else
	            return null;
	          break;
	        case 0x86: //CodecId
	          var codecID = this.dataInterface.readString(this.currentElement.size);
	          if (codecID !== null)
	            this.trackData.codecID = codecID;
	          else
	            return null;
	          break;
	        case 0x9C: //FlagLacing 
	          var lacing = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (lacing !== null)
	            this.trackData.lacing = lacing;
	          else
	            return null;
	          break;
	        case 0xB9: //FlagEnabled
	          var flagEnabled = this.dataInterface.getBinary(this.currentElement.size);
	          if (flagEnabled !== null) {
	            this.trackData.flagEnabled = flagEnabled;
	          } else {
	            return null;
	          }
	          break;
	        case 0x55AA: //FlagForced
	          var flagForced = this.dataInterface.getBinary(this.currentElement.size);
	          if (flagForced !== null) {
	            this.trackData.flagForced = flagForced;
	          } else {
	            return null;
	          }
	          break;
	        case 0x63A2: //Codec Private 
	          var codecPrivate = this.dataInterface.getBinary(this.currentElement.size);
	          if (codecPrivate !== null) {
	            this.trackData.codecPrivate = codecPrivate;
	          } else {
	            return null;
	          }
	          break;
	        case 0x56AA: //Codec Delay 
	          var codecDelay = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (codecDelay !== null)
	            this.trackData.codecDelay = codecDelay;
	          else
	            return null;
	          break;
	        case 0x56BB: //Pre Seek Roll 
	          var seekPreRoll = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (seekPreRoll !== null)
	            this.trackData.seekPreRoll = seekPreRoll;
	          else
	            return null;
	          break;
	        case 0x73C5: //Track UID
	          var trackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (trackUID !== null)
	            this.trackData.trackUID = trackUID;
	          else
	            return null;
	          break;
	        case 0x6DE7: //MinCache
	          var minCache = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (minCache !== null)
	            this.trackData.minCache = minCache;
	          else
	            return null;
	          break;
	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        case 0x88: //CRC-32
	          var flagDefault = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (flagDefault !== null)
	            this.flagDefault = flagDefault;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        default:
	          if (!this.dataInterface.peekBytes(this.currentElement.size))
	            return false;
	          else
	            this.dataInterface.skipBytes(this.currentElement.size);
	          console.warn("track data element not found, skipping : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }
	    this.loaded = true;
	  }

	  getTrackEntry() {
	    this.tempTrack.loadMeta(this.trackData);
	    var tempTrack = this.tempTrack;
	    this.tempTrack = null;
	    this.loading = false;
	    return tempTrack;
	  }
	}

	class TrackSettings {
	  constructor() {
	    this.offset = -1;
	    this.size = -1;
	  }
	}

	module.exports = Tracks;


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

	const Track = __webpack_require__(11);

	class AudioTrack extends Track {
	  constructor(trackHeader, dataInterface) {
	    super();
	    this.dataInterface = dataInterface;
	    this.offset = trackHeader.offset;
	    this.size = trackHeader.size;
	    this.end = trackHeader.end;
	    this.loaded = false;
	    this.rate = null;
	    this.channel = null;
	    this.bitDepth = null;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null) return null;
	      }

	      switch (this.currentElement.id) {
	        //TODO add duration and title
	        case 0xB5: //Sample Frequency //TODO: MAKE FLOAT
	          var rate = this.dataInterface.readFloat(this.currentElement.size);
	          if (rate !== null) this.rate = rate;
	          else
	            return null;
	          break;
	        case 0x9F: //Channels 
	          var channels = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (channels !== null) this.channels = channels;
	          else
	            return null;
	          break;
	        case 0x6264: //bitDepth 
	          var bitDepth = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (bitDepth !== null)
	            this.bitDepth = bitDepth;
	          else
	            return null;
	          break;
	        default:
	          console.warn("Ifno element not found, skipping");
	          break;
	      }
	      this.currentElement = null;
	    }
	    this.loaded = true;
	  }
	}

	module.exports = AudioTrack;


/***/ }),
/* 11 */
/***/ (function(module, exports) {

	class Track {
	  loadMeta(meta) {
	    for (const key in meta) {
	      this[key] = meta[key];
	    }
	  }
	}

	module.exports = Track;


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

	const Track = __webpack_require__(11);

	class VideoTrack extends Track {
	  constructor(trackHeader, dataInterface) {
	    super();
	    this.dataInterface = dataInterface;
	    this.offset = trackHeader.offset;
	    this.size = trackHeader.size;
	    this.end = trackHeader.end;
	    this.loaded = false;
	    this.width = null;
	    this.height = null;
	    this.displayWidth = null;
	    this.displayHeight = null;
	    this.displayUnit = 0;
	    this.stereoMode = null;
	    this.frameRate = null;
	    this.pixelCropBottom = 0;
	    this.pixelCropTop = 0;
	    this.pixelCropLeft = 0;
	    this.pixelCropRight = 0;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        //TODO add color
	        case 0xB0: //Pixel width
	          var width = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (width !== null)
	            this.width = width;
	          else
	            return null;
	          break;
	        case 0xBA: //Pixel Height 
	          var height = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (height !== null)
	            this.height = height;
	          else
	            return null;
	          break;
	        case 0x54B0: //Display width
	          var displayWidth = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (displayWidth !== null)
	            this.displayWidth = displayWidth;
	          else
	            return null;
	          break;
	        case 0x54BA: //Display height
	          var displayHeight = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (displayHeight !== null)
	            this.displayHeight = displayHeight;
	          else
	            return null;
	          break;
	        case 0x54B2: //Display unit
	          var displayUnit = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (displayUnit !== null)
	            this.displayUnit = displayUnit;
	          else
	            return null;
	          break;
	        case 0x53B8: //Stereo mode
	          var stereoMode = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (stereoMode !== null)
	            this.stereoMode = stereoMode;
	          else
	            return null;
	          break;
	        case 0x2383E3: //FRAME RATE //NEEDS TO BE FLOAT
	          var frameRate = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (frameRate !== null)
	            this.frameRate = frameRate;
	          else
	            return null;
	          break;
	        case 0x9A: //FlagInterlaced
	          var flagInterlaced = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (flagInterlaced !== null)
	            this.flagInterlaced = flagInterlaced;
	          else
	            return null;
	          break;
	        case 0x55B0: //Color
	          console.error("NO COLOR LOADING YET");
	        default:
	          console.warn("Info element not found, skipping: " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }

	    if (!this.displayWidth) {
	      this.displayWidth = this.width - this.pixelCropLeft;// - Math.PI;
	    }

	    if (!this.displayHeight) {
	      this.displayHeight = this.height - this.pixelCropTop;// - Math.PI;
	    }
	    this.loaded = true;
	  }
	}

	module.exports = VideoTrack;

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

	const UNSET = -1;
	const ElementHeader = __webpack_require__(4);
	const SimpleBlock = __webpack_require__(14);
	const BlockGroup = __webpack_require__(15);

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
	    this.position = null;
	    this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
	    this.tempElementHeader.reset();
	    this.tempBlock = new SimpleBlock();
	    this.blockGroups = [];
	    //this.demuxer.loadedMetadata = true; // Testing only
	    return true;
	  }

	  init() {

	  }

	  reset() {

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
	          if (timeCode !== null) {
	            this.timeCode = timeCode;
	            //console.warn("timecode seeked to:" + this.timeCode);
	          } else {
	            return null;
	          }
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
	          //if(!this.dataInterface.currentBuffer)
	          //      return false;
	          if (!this.tempBlock.loaded)
	            return 0;
	          //else
	          //  this.blocks.push(this.tempBlock); //Later save positions for seeking and debugging
	          this.tempBlock.reset();
	          this.tempEntry = null;
	          this.tempElementHeader.reset();
	          if (this.dataInterface.offset !== this.end) {
	            if (!this.dataInterface.currentBuffer)
	              return false;
	            return true; //true?
	          }
	          break;
	        case 0xA7: //Position
	          var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
	          if (timeCode !== null) {
	            this.timeCode = timeCode;
	            //console.warn("timecode seeked to:" + this.timeCode);
	          } else {
	            return null;
	          }
	          break;
	        case 0xA0: //Block Group
	          if (!this.currentBlockGroup)
	            this.currentBlockGroup = new BlockGroup(this.tempElementHeader.getData(), this.dataInterface);
	          this.currentBlockGroup.load();
	          if (!this.currentBlockGroup.loaded)
	            return false;
	          this.blockGroups.push(this.currentTag);
	          this.currentBlockGroup = null;
	          break;
	        case 0xAB: //PrevSize
	          var prevSize = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
	          if (prevSize !== null)
	            this.prevSize = prevSize;
	          else
	            return null;
	          break;
	        //TODO, ADD VOID
	        default:
	          console.warn("cluster data element not found, skipping : " + this.tempElementHeader.id.toString(16));
	          throw "cluster";
	          //This means we probably are out of the cluster now, double check bounds when end not available
	          break;
	      }
	      this.tempEntry = null;
	      this.tempElementHeader.reset();
	      //return 1;
	    }
	    this.loaded = true;
	    return status;
	  }
	}

	module.exports = Cluster;


/***/ }),
/* 14 */
/***/ (function(module, exports) {

	
	const NO_LACING = 0;
	const XIPH_LACING = 1;
	const FIXED_LACING = 2;
	const EBML_LACING = 3;

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
	    this.ebmlLacedSizes = [];
	    this.ebmlParsedSizes = [];
	    this.ebmlLacedSizesParsed = false;
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
	    this.laceFrameHelper = null;
	    this.lacedFrameHeaderSize = null;
	    this.ebmlLacedSizes = [];
	    this.lacedFrameDataSize = null;
	    this.fixedFrameLength = null;
	    this.firstLacedFrameSize = null;
	    this.ebmlParsedSizes = [];
	    this.ebmlLacedSizesParsed = false;
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
	      this.invisible = (((this.flags >> 2) & 0x01) === 0) ? true : false;
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
	          //if (dataInterface.usingBufferedRead === false)
	          //    throw "SHOULD BE BUFFERED READ";
	          //console.warn("frame has been split");
	          return null;
	        }

	        this.fixedFrameLength = (this.frameLength - 1) / this.lacedFrameCount;
	        var fullTimeCode = this.timeCode + this.cluster.timeCode;
	        //var fullTimeCode = this.cluster.timeCode;
	        var timeStamp = fullTimeCode / 1000;
	        if (timeStamp < 0) {
	          throw "INVALID TIMESTAMP";
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
	        tempFrame = null;
	        break;
	      case EBML_LACING:
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
	        if (!this.firstLacedFrameSize) {
	          var firstLacedFrameSize = this.dataInterface.readVint();
	          if (firstLacedFrameSize !== null) {
	            this.firstLacedFrameSize = firstLacedFrameSize;
	            this.ebmlLacedSizes.push(this.firstLacedFrameSize);
	          } else {
	            return null;
	          }
	        }
	        if (!this.tempCounter) {
	          this.tempCounter = 0;
	        }

	        while (this.tempCounter < this.lacedFrameCount - 1) {
	          var frameSize = dataInterface.readLacingSize();
	          if (frameSize === null)
	            return null;
	          this.ebmlLacedSizes.push(frameSize);
	          this.tempCounter++;
	        }

	        //Now parse the frame sizes

	        if (!this.ebmlLacedSizesParsed) {
	          this.ebmlParsedSizes[0] = this.ebmlLacedSizes[0];
	          var total = this.ebmlParsedSizes[0];
	          for (var i = 1; i < this.lacedFrameCount - 1; i++) {
	            this.ebmlParsedSizes[i] = this.ebmlLacedSizes[i] + this.ebmlParsedSizes[i - 1];
	            total += this.ebmlParsedSizes[i];
	          }
	          if (!this.lacedFrameDataSize)
	            this.lacedFrameDataSize = this.end - dataInterface.offset;

	          var lastSize = this.lacedFrameDataSize - total;
	          this.ebmlParsedSizes.push(lastSize);


	          this.ebmlLacedSizesParsed = true;
	          this.ebmlTotalSize = total + lastSize;
	        }
	        var tempFrame = dataInterface.getBinary(this.lacedFrameDataSize);
	        if (tempFrame === null) {
	          return null;
	        }

	        var fullTimeCode = this.timeCode + this.cluster.timeCode;
	        //var fullTimeCode = this.cluster.timeCode;
	        var timeStamp = fullTimeCode / 1000;
	        if (timeStamp < 0) {
	          throw "INVALID TIMESTAMP";
	        }

	        var start = 0;
	        var end = this.ebmlParsedSizes[0];
	        for (var i = 0; i < this.lacedFrameCount; i++) {

	          if (this.track.trackType === 1) {
	            this.videoPackets.push({//This could be improved
	              data: tempFrame.slice(start, end),
	              timestamp: timeStamp,
	              keyframeTimestamp: timeStamp,
	              isKeyframe: this.keyFrame
	            });
	          } else if (this.track.trackType === 2) {
	            this.audioPackets.push({//This could be improved
	              data: tempFrame.slice(start, end),
	              timestamp: timeStamp
	            });
	          }

	          start += this.ebmlParsedSizes[i];
	          end += this.ebmlParsedSizes[i];
	          if (i === this.lacedFrameCount - 1) {
	            end = null;
	          }
	        }
	        this.tempCounter = null;
	        tempFrame = null;
	        break;
	      case XIPH_LACING:
	      case NO_LACING:
	        if (this.lacing === EBML_LACING) {
	          console.warn("EBML_LACING");
	        }
	        if (this.lacing === XIPH_LACING) {
	          console.warn("XIPH_LACING");
	        }
	        if (!this.frameLength) {
	          this.frameLength = this.size - this.headerSize;
	          if (this.frameLength <= 0)
	            throw "INVALID FRAME LENGTH " + this.frameLength;
	        }



	        var tempFrame = dataInterface.getBinary(this.frameLength);


	        if (tempFrame === null) {
	          //if (dataInterface.usingBufferedRead === false)
	          //    throw "SHOULD BE BUFFERED READ " + dataInterface.offset;
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
	            isKeyframe: this.keyFrame
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


/***/ }),
/* 15 */
/***/ (function(module, exports) {

	class BlockGroup {
	  constructor(blockGroupHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = blockGroupHeader.offset;
	    this.size = blockGroupHeader.size;
	    this.end = blockGroupHeader.end;
	    this.loaded = false;
	    this.tempElement = null;
	    this.currentElement = null;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0xA1: //Block
	          var block = this.dataInterface.getBinary(this.currentElement.size);
	          if (block !== null)
	            block;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        case 0x9b: //BlockDuration
	          var blockDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (blockDuration !== null)
	            this.blockDuration = blockDuration;
	          else
	            return null;
	          break;
	        case 0xFB: //ReferenceBlock
	          var referenceBlock = this.dataInterface.readSignedInt(this.currentElement.size);
	          if (referenceBlock !== null)
	            this.referenceBlock = referenceBlock;
	          else
	            return null;
	          break;
	        case 0x75A2: //DiscardPadding
	          var discardPadding = this.dataInterface.readSignedInt(this.currentElement.size);
	          if (discardPadding !== null)
	            this.discardPadding = discardPadding;
	          else
	            return null;
	          break;
	        default:
	          console.warn("block group element not found, skipping " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }
	    this.loaded = true;
	  }
	}

	module.exports = BlockGroup;


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

	const CueTrackPositions = __webpack_require__(17);

	/**
	 * @classdesc This class keeps track of keyframes for seeking
	 * 76514630 - 43 - 8
	 */

	class Cues {
	  constructor(cuesHeader, dataInterface, demuxer) {
	    this.dataInterface = dataInterface;
	    this.offset = cuesHeader.offset;
	    this.size = cuesHeader.size;
	    this.end = cuesHeader.end;
	    this.entries = [];
	    this.loaded = false;
	    this.tempEntry = null;
	    this.demuxer = demuxer;
	    this.currentElement = null;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0xBB: //CuePoint
	          if (!this.tempEntry)
	            this.tempEntry = new CuePoint(this.currentElement, this.dataInterface);
	          this.tempEntry.load();
	          if (!this.tempEntry.loaded)
	            return;
	          else
	            this.entries.push(this.tempEntry);
	          break;
	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        //TODO, ADD VOID
	        default:
	          console.warn("Cue Head element not found " + this.currentElement.id.toString(16)); // probably bad
	          break;
	      }

	      this.tempEntry = null;
	      this.currentElement = null;
	      //this.cueTrackPositions = this.tempEntry;
	      //this.tempEntry = null;
	    }


	    if (this.dataInterface.offset !== this.end) {
	      console.log(this);
	      throw "INVALID CUE FORMATTING";
	    }

	    this.loaded = true;
	    //console.warn(this);
	  }

	  getCount() {
	    return this.cuePoints.length;
	  }

	  init() {

	  }

	  preloadCuePoint() {

	  }

	  find() {

	  }

	  getFirst() {

	  }

	  getLast() {

	  }

	  getNext() {

	  }

	  getBlock() {

	  }

	  findOrPreloadCluster() {

	  }

	}

	class CuePoint {
	  constructor(cuesPointHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = cuesPointHeader.offset;
	    this.size = cuesPointHeader.size;
	    this.end = cuesPointHeader.end;
	    this.loaded = false;
	    this.tempElement = null;
	    this.currentElement = null;
	    this.cueTime = null;
	    this.cueTrackPositions = null;
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0xB7: //Cue Track Positions
	          if (!this.cueTrackPositions)
	            this.cueTrackPositions = new CueTrackPositions(this.currentElement, this.dataInterface);
	          this.cueTrackPositions.load();
	          if (!this.cueTrackPositions.loaded)
	            return;
	          break;

	        case 0xB3: //Cue Time 
	          var cueTime = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (cueTime !== null)
	            this.cueTime = cueTime;
	          else
	            return null;
	          break;
	        default:
	          console.warn("Cue Point not found, skipping");
	          break;
	      }
	      this.currentElement = null;
	    }
	    this.loaded = true;
	  }
	}

	module.exports = Cues;


/***/ }),
/* 17 */
/***/ (function(module, exports) {

	class CueTrackPositions {
	  constructor(cuesPointHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = cuesPointHeader.offset;
	    this.size = cuesPointHeader.size;
	    this.end = cuesPointHeader.end;
	    this.loaded = false;
	    this.tempElement = null;
	    this.currentElement = null;
	    this.cueTrack = null;
	    this.cueClusterPosition = 0;
	    this.cueRelativePosition = 0;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0xF7: //CueTrack
	          var cueTrack = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (cueTrack !== null)
	            this.cueTrack = cueTrack;
	          else
	            return null;
	          break;
	        case 0xF1: //Cue ClusterPosition 
	          var cueClusterPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (cueClusterPosition !== null)
	            this.cueClusterPosition = cueClusterPosition;
	          else
	            return null;
	          break;
	        case 0xF0: //CueRelativePosition
	          var cueRelativePosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (cueRelativePosition !== null)
	            this.cueRelativePosition = cueRelativePosition;
	          else
	            return null;
	          break;
	        default:
	          console.warn("Cue track positions not found! " + this.currentElement.id);
	          break;
	      }
	      this.currentElement = null;
	    }
	    if (this.dataInterface.offset !== this.end)
	      console.error("Invalid Seek Formatting");
	    this.loaded = true;
	  }
	}

	module.exports = CueTrackPositions;


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	const Tag = __webpack_require__(19);

	class Tags {
	  constructor(tagsHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = tagsHeader.offset;
	    this.size = tagsHeader.size;
	    this.end = tagsHeader.end;
	    this.entries = [];
	    this.loaded = false;
	    this.tempEntry = null;
	    this.currentElement = null;
	    this.currentTag = null;
	    this.tags = [];
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }

	      switch (this.currentElement.id) {
	        case 0x7373: //Tag
	          if (!this.currentTag)
	            this.currentTag = new Tag(this.currentElement.getData(), this.dataInterface);
	          this.currentTag.load();
	          if (!this.currentTag.loaded)
	            return false;

	          this.tags.push(this.currentTag);
	          this.currentTag = null;
	          break;

	        case 0xbf: //CRC-32
	          var crc = this.dataInterface.getBinary(this.currentElement.size);
	          if (crc !== null)
	            crc;
	          //this.docTypeReadVersion = docTypeReadVersion;
	          else
	            return null;
	          break;
	        default:
	          if (!this.dataInterface.peekBytes(this.currentElement.size))
	            return false;
	          else
	            this.dataInterface.skipBytes(this.currentElement.size);
	          console.warn("tags element not found, skipping" + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }
	    this.loaded = true;
	  }
	}

	module.exports = Tags;


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

	const Targets = __webpack_require__(20);
	const SimpleTag = __webpack_require__(21);

	class Tag {
	  constructor(tagHeader, dataInterface, demuxer) {
	    this.dataInterface = dataInterface;
	    this.offset = tagHeader.offset;
	    this.size = tagHeader.size;
	    this.end = tagHeader.end;
	    this.entries = [];
	    this.loaded = false;
	    this.tempEntry = null;
	    this.demuxer = demuxer;
	    this.currentElement = null;
	    this.targets = [];
	    this.simpleTags = [];
	  }

	  load() {
	    var end = this.end;
	    while (this.dataInterface.offset < end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0x63C0: //Targets
	          if (!this.tempEntry)
	            this.tempEntry = new Targets(this.currentElement, this.dataInterface);
	          this.tempEntry.load();
	          if (!this.tempEntry.loaded)
	            return null;
	          this.targets.push(this.tempEntry);
	          this.tempEntry = null;
	          break;
	        case 0x67C8: //SimpleTag
	          if (!this.tempEntry)
	            this.tempEntry = new SimpleTag(this.currentElement, this.dataInterface);
	          this.tempEntry.load();
	          if (!this.tempEntry.loaded)
	            return null;

	          this.simpleTags.push(this.tempEntry);
	          this.tempEntry = null;
	          break;
	        default:
	          if (!this.dataInterface.peekBytes(this.currentElement.size))
	            return false;
	          else
	            this.dataInterface.skipBytes(this.currentElement.size);
	          console.warn("tag element not found: " + this.currentElement.id.toString(16)); // probably bad
	          break;
	      }

	      this.tempEntry = null;
	      this.currentElement = null;
	      //this.cueTrackPositions = this.tempEntry;
	      //this.tempEntry = null;
	    }

	    if (this.dataInterface.offset !== this.end) {
	      console.log(this);
	      throw "INVALID CUE FORMATTING";
	    }

	    this.loaded = true;
	  }
	}

	module.exports = Tag;


/***/ }),
/* 20 */
/***/ (function(module, exports) {

	class Targets {
	  constructor(targetsHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = targetsHeader.offset;
	    this.size = targetsHeader.size;
	    this.end = targetsHeader.end;
	    this.loaded = false;
	    this.tempElement = null;
	    this.currentElement = null;
	    this.cueTrack = null;
	    this.cueClusterPosition = 0;
	    this.cueRelativePosition = 0;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null) return null;
	      }
	      switch (this.currentElement.id) {
	        case 0x63C5: // tagTrackUID
	          var tagTrackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
	          if (tagTrackUID !== null) this.tagTrackUID = tagTrackUID;
	          else
	            return null;
	          break;
	        default:
	          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
	            return false;
	          } else {
	            this.dataInterface.skipBytes(this.currentElement.size);
	          }
	          console.warn("targets element not found ! : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }

	    if (this.dataInterface.offset !== this.end)
	      console.error('Invalid Targets Formatting');
	    this.loaded = true;
	  }
	}

	module.exports = Targets;


/***/ }),
/* 21 */
/***/ (function(module, exports) {

	class SimpleTag {
	  constructor(simpleTagHeader, dataInterface) {
	    this.dataInterface = dataInterface;
	    this.offset = simpleTagHeader.offset;
	    this.size = simpleTagHeader.size;
	    this.end = simpleTagHeader.end;
	    this.loaded = false;
	    this.tempElement = null;
	    this.currentElement = null;
	    this.cueTrack = null;
	    this.cueClusterPosition = 0;
	    this.cueRelativePosition = 0;
	    this.tagName = null;
	    this.tagString = null;
	  }

	  load() {
	    while (this.dataInterface.offset < this.end) {
	      if (!this.currentElement) {
	        this.currentElement = this.dataInterface.peekElement();
	        if (this.currentElement === null)
	          return null;
	      }
	      switch (this.currentElement.id) {
	        case 0x45A3: //TagName
	          var tagName = this.dataInterface.readString(this.currentElement.size);
	          if (tagName !== null)
	            this.tagName = tagName;
	          else
	            return null;
	          break;
	        case 0x4487: //TagString
	          var tagString = this.dataInterface.readString(this.currentElement.size);
	          if (tagString !== null)
	            this.tagString = tagString;
	          else
	            return null;
	          break;
	        default:
	          if (!this.dataInterface.peekBytes(this.currentElement.size))
	            return false;
	          else
	            this.dataInterface.skipBytes(this.currentElement.size);
	          console.warn("simple tag element not found ! : " + this.currentElement.id.toString(16));
	          break;
	      }
	      this.currentElement = null;
	    }

	    if (this.dataInterface.offset !== this.end)
	      console.error("Invalid Targets Formatting");
	    this.loaded = true;
	  }
	}

	module.exports = SimpleTag;


/***/ }),
/* 22 */
/***/ (function(module, exports) {

	/*!
	Copyright (C) 2013-2017 by Andrea Giammarchi - @WebReflection

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.

	*/
	var
	  // should be a not so common char
	  // possibly one JSON does not encode
	  // possibly one encodeURIComponent does not encode
	  // right now this char is '~' but this might change in the future
	  specialChar = '~',
	  safeSpecialChar = '\\x' + (
	    '0' + specialChar.charCodeAt(0).toString(16)
	  ).slice(-2),
	  escapedSafeSpecialChar = '\\' + safeSpecialChar,
	  specialCharRG = new RegExp(safeSpecialChar, 'g'),
	  safeSpecialCharRG = new RegExp(escapedSafeSpecialChar, 'g'),

	  safeStartWithSpecialCharRG = new RegExp('(?:^|([^\\\\]))' + escapedSafeSpecialChar),

	  indexOf = [].indexOf || function(v){
	    for(var i=this.length;i--&&this[i]!==v;);
	    return i;
	  },
	  $String = String  // there's no way to drop warnings in JSHint
	                    // about new String ... well, I need that here!
	                    // faked, and happy linter!
	;

	function generateReplacer(value, replacer, resolve) {
	  var
	    inspect = !!replacer,
	    path = [],
	    all  = [value],
	    seen = [value],
	    mapp = [resolve ? specialChar : '[Circular]'],
	    last = value,
	    lvl  = 1,
	    i, fn
	  ;
	  if (inspect) {
	    fn = typeof replacer === 'object' ?
	      function (key, value) {
	        return key !== '' && replacer.indexOf(key) < 0 ? void 0 : value;
	      } :
	      replacer;
	  }
	  return function(key, value) {
	    // the replacer has rights to decide
	    // if a new object should be returned
	    // or if there's some key to drop
	    // let's call it here rather than "too late"
	    if (inspect) value = fn.call(this, key, value);

	    // did you know ? Safari passes keys as integers for arrays
	    // which means if (key) when key === 0 won't pass the check
	    if (key !== '') {
	      if (last !== this) {
	        i = lvl - indexOf.call(all, this) - 1;
	        lvl -= i;
	        all.splice(lvl, all.length);
	        path.splice(lvl - 1, path.length);
	        last = this;
	      }
	      // console.log(lvl, key, path);
	      if (typeof value === 'object' && value) {
	    	// if object isn't referring to parent object, add to the
	        // object path stack. Otherwise it is already there.
	        if (indexOf.call(all, value) < 0) {
	          all.push(last = value);
	        }
	        lvl = all.length;
	        i = indexOf.call(seen, value);
	        if (i < 0) {
	          i = seen.push(value) - 1;
	          if (resolve) {
	            // key cannot contain specialChar but could be not a string
	            path.push(('' + key).replace(specialCharRG, safeSpecialChar));
	            mapp[i] = specialChar + path.join(specialChar);
	          } else {
	            mapp[i] = mapp[0];
	          }
	        } else {
	          value = mapp[i];
	        }
	      } else {
	        if (typeof value === 'string' && resolve) {
	          // ensure no special char involved on deserialization
	          // in this case only first char is important
	          // no need to replace all value (better performance)
	          value = value .replace(safeSpecialChar, escapedSafeSpecialChar)
	                        .replace(specialChar, safeSpecialChar);
	        }
	      }
	    }
	    return value;
	  };
	}

	function retrieveFromPath(current, keys) {
	  for(var i = 0, length = keys.length; i < length; current = current[
	    // keys should be normalized back here
	    keys[i++].replace(safeSpecialCharRG, specialChar)
	  ]);
	  return current;
	}

	function generateReviver(reviver) {
	  return function(key, value) {
	    var isString = typeof value === 'string';
	    if (isString && value.charAt(0) === specialChar) {
	      return new $String(value.slice(1));
	    }
	    if (key === '') value = regenerate(value, value, {});
	    // again, only one needed, do not use the RegExp for this replacement
	    // only keys need the RegExp
	    if (isString) value = value .replace(safeStartWithSpecialCharRG, '$1' + specialChar)
	                                .replace(escapedSafeSpecialChar, safeSpecialChar);
	    return reviver ? reviver.call(this, key, value) : value;
	  };
	}

	function regenerateArray(root, current, retrieve) {
	  for (var i = 0, length = current.length; i < length; i++) {
	    current[i] = regenerate(root, current[i], retrieve);
	  }
	  return current;
	}

	function regenerateObject(root, current, retrieve) {
	  for (var key in current) {
	    if (current.hasOwnProperty(key)) {
	      current[key] = regenerate(root, current[key], retrieve);
	    }
	  }
	  return current;
	}

	function regenerate(root, current, retrieve) {
	  return current instanceof Array ?
	    // fast Array reconstruction
	    regenerateArray(root, current, retrieve) :
	    (
	      current instanceof $String ?
	        (
	          // root is an empty string
	          current.length ?
	            (
	              retrieve.hasOwnProperty(current) ?
	                retrieve[current] :
	                retrieve[current] = retrieveFromPath(
	                  root, current.split(specialChar)
	                )
	            ) :
	            root
	        ) :
	        (
	          current instanceof Object ?
	            // dedicated Object parser
	            regenerateObject(root, current, retrieve) :
	            // value as it is
	            current
	        )
	    )
	  ;
	}

	var CircularJSON = {
	  stringify: function stringify(value, replacer, space, doNotResolve) {
	    return CircularJSON.parser.stringify(
	      value,
	      generateReplacer(value, replacer, !doNotResolve),
	      space
	    );
	  },
	  parse: function parse(text, reviver) {
	    return CircularJSON.parser.parse(
	      text,
	      generateReviver(reviver)
	    );
	  },
	  // A parser should be an API 1:1 compatible with JSON
	  // it should expose stringify and parse methods.
	  // The default parser is the native JSON.
	  parser: JSON
	};

	module.exports = CircularJSON;


/***/ })
/******/ ]);