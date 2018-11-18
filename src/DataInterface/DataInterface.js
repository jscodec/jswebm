var INITIAL_COUNTER = -1;

const ElementHeader = require('../ElementHeader.js');
const DateParser = require('./DateParser.js');

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