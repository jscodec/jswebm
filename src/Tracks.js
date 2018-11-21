const Seek = require('./Seek.js');
const AudioTrack = require('./AudioTrack.js');
const VideoTrack = require('./VideoTrack.js');

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
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        // TODO support content encodings
        case 0xE0: // Video Track
          if (!this.tempTrack)
            this.tempTrack = new VideoTrack(this.currentElement, this.dataInterface);
          this.tempTrack.load();
          if (!this.tempTrack.loaded) return;
          break;
        case 0xE1: // Audio Number
          if (!this.tempTrack)
            this.tempTrack = new AudioTrack(this.currentElement, this.dataInterface);
          this.tempTrack.load();
          if (!this.tempTrack.loaded) return;
          break;
        case 0xD7: { // Track Number
          const trackNumber = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackNumber !== null) {
            this.trackData.trackNumber = trackNumber;
          } else {
            return null;
          }
          break;
        }
        case 0x83: { // TrackType 
          const trackType = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackType !== null) {
            this.trackData.trackType = trackType;
          } else {
            return null;
          }
          break;
        }
        case 0x536E: { // Name
          const name = this.dataInterface.readString(this.currentElement.size);
          if (name !== null) {
            this.trackData.name = name;
          } else {
            return null;
          }
          break;
        }
        case 0x258688: { // CodecName
          const codecName = this.dataInterface.readString(this.currentElement.size);
          if (codecName !== null) {
            this.trackData.codecName = codecName;
          } else {
            return null;
          }
          break;
        }
        case 0x22B59C: // Language
          var language = this.dataInterface.readString(this.currentElement.size);
          if (language !== null)
            this.trackData.language = language;
          else
            return null;
          break;
        case 0x23E383: // DefaultDuration 
          var defaultDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (defaultDuration !== null)
            this.trackData.defaultDuration = defaultDuration;
          else
            return null;
          break;
        case 0x86: // CodecId
          var codecID = this.dataInterface.readString(this.currentElement.size);
          if (codecID !== null)
            this.trackData.codecID = codecID;
          else
            return null;
          break;
        case 0x9C: // FlagLacing 
          var lacing = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (lacing !== null)
            this.trackData.lacing = lacing;
          else
            return null;
          break;
        case 0xB9: // FlagEnabled
          var flagEnabled = this.dataInterface.getBinary(this.currentElement.size);
          if (flagEnabled !== null) {
            this.trackData.flagEnabled = flagEnabled;
          } else {
            return null;
          }
          break;
        case 0x55AA: // FlagForced
          var flagForced = this.dataInterface.getBinary(this.currentElement.size);
          if (flagForced !== null) {
            this.trackData.flagForced = flagForced;
          } else {
            return null;
          }
          break;
        case 0x63A2: // Codec Private 
          var codecPrivate = this.dataInterface.getBinary(this.currentElement.size);
          if (codecPrivate !== null) {
            this.trackData.codecPrivate = codecPrivate;
          } else {
            return null;
          }
          break;
        case 0x56AA: // Codec Delay 
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
        case 0x73C5: // Track UID
          var trackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackUID !== null)
            this.trackData.trackUID = trackUID;
          else
            return null;
          break;
        case 0x6DE7: // MinCache
          var minCache = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (minCache !== null)
            this.trackData.minCache = minCache;
          else
            return null;
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null)
            crc;
          //this.docTypeReadVersion = docTypeReadVersion;
          else
            return null;
          break;
        case 0x88: // CRC-32
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
