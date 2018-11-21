const Seek = require('./Seek.js');

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
        case 0x4DBB: // Seek
          if (!this.tempEntry)
            this.tempEntry = new Seek(this.currentElement, this.dataInterface);
          this.tempEntry.load();
          if (!this.tempEntry.loaded)
            return;
          else
            this.entries.push(this.tempEntry);
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null)
            crc;
          // this.docTypeReadVersion = docTypeReadVersion;
          else
            return null;
          break;
        // TODO, ADD VOID
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
