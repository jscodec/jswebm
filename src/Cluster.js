const UNSET = -1;
const ElementHeader = require('./ElementHeader.js');
const SimpleBlock = require('./SimpleBlock.js');
const BlockGroup = require('./BlockGroup.js');

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
        case 0xE7: // TimeCode
          var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (timeCode !== null) {
            this.timeCode = timeCode;
          } else {
            return null;
          }
          break;
        case 0xA3: // Simple Block
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
          // else
          // this.blocks.push(this.tempBlock); //Later save positions for seeking and debugging
          this.tempBlock.reset();
          this.tempEntry = null;
          this.tempElementHeader.reset();
          if (this.dataInterface.offset !== this.end) {
            if (!this.dataInterface.currentBuffer)
              return false;
            return true;
          }
          break;
        case 0xA7: // Position
          var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (timeCode !== null) {
            this.timeCode = timeCode;
          } else {
            return null;
          }
          break;
        case 0xA0: // Block Group
          if (!this.currentBlockGroup)
            this.currentBlockGroup = new BlockGroup(this.tempElementHeader.getData(), this.dataInterface);
          this.currentBlockGroup.load();
          if (!this.currentBlockGroup.loaded)
            return false;
          this.blockGroups.push(this.currentTag);
          this.currentBlockGroup = null;
          break;
        case 0xAB: // PrevSize
          var prevSize = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (prevSize !== null)
            this.prevSize = prevSize;
          else
            return null;
          break;
        // TODO, ADD VOID
        default:
          console.warn("cluster data element not found, skipping : " + this.tempElementHeader.id.toString(16));
          throw "cluster";
          // This means we probably are out of the cluster now, double check bounds when end not available
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
