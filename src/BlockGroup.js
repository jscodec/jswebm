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
