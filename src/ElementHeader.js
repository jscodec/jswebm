class ElementHeader {
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
