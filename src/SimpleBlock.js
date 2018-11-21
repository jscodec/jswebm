
const NO_LACING = 0;
const XIPH_LACING = 1;
const FIXED_LACING = 2;
const EBML_LACING = 3;

class SimpleBlock {
  constructor() {
    this.cluster;
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
    this.stop = null; // = this.offset + this.size;
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
    this.track = this.trackEntries[this.trackNumber - 1];
  }

  load() {
    var dataInterface = this.dataInterface;
    if (this.loaded) {
      throw new Error('ALREADY LOADED');
    }

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

        // Now parse the frame sizes
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
      throw new Error('INVALID BLOCK SIZE');
    }

    this.loaded = true;
    this.headerSize = null;
    this.tempFrame = null;
    this.tempCounter = null;
    this.frameLength = null;
  }
}

module.exports = SimpleBlock;
