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
