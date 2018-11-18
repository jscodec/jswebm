const Tag = require('./Tag.js');

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
