const Targets = require('./Targets.js');
const SimpleTag = require('./SimpleTag.js');

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
