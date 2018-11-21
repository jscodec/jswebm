const Track = require('./Track.js');

class VideoTrack extends Track {
  constructor(trackHeader, dataInterface) {
    super();
    this.dataInterface = dataInterface;
    this.offset = trackHeader.offset;
    this.size = trackHeader.size;
    this.end = trackHeader.end;
    this.loaded = false;
    this.width = null;
    this.height = null;
    this.displayWidth = null;
    this.displayHeight = null;
    this.displayUnit = 0;
    this.stereoMode = null;
    this.frameRate = null;
    this.pixelCropBottom = 0;
    this.pixelCropTop = 0;
    this.pixelCropLeft = 0;
    this.pixelCropRight = 0;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        // TODO add color
        case 0xB0: { // Pixel width
          const width = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (width !== null) {
            this.width = width;
          } else {
            return null;
          }
          break;
        }
        case 0xBA: { // Pixel Height
          const height = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (height !== null) {
            this.height = height;
          } else {
            return null;
          }
          break;
        }
        case 0x54B0: { // Display width
          const displayWidth = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayWidth !== null) {
            this.displayWidth = displayWidth;
          } else {
            return null;
          }
          break;
        }
        case 0x54BA: { // Display height
          const displayHeight = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayHeight !== null) {
            this.displayHeight = displayHeight;
          } else {
            return null;
          }
          break;
        }
        case 0x54B2: { // Display unit
          const displayUnit = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayUnit !== null) {
            this.displayUnit = displayUnit;
          } else {
            return null;
          }
          break;
        }
        case 0x53B8: { // Stereo mode
          const stereoMode = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (stereoMode !== null) {
            this.stereoMode = stereoMode;
          } else {
            return null;
          }
          break;
        }
        case 0x2383E3: { // FRAME RATE - NEEDS TO BE FLOAT
          const frameRate = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (frameRate !== null) {
            this.frameRate = frameRate;
          } else {
            return null;
          }
          break;
        }
        case 0x9A: { // FlagInterlaced
          const flagInterlaced = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (flagInterlaced !== null) {
            this.flagInterlaced = flagInterlaced;
          } else {
            return null;
          }
          break;
        }
        case 0x55B0: { // Color
          throw new Error('COLOR NOT IMPLEMENTED');
        }
        default:
          console.warn(`Info element not found, skipping: ${this.currentElement.id.toString(16)}`);
          break;
      }
      this.currentElement = null;
    }

    if (!this.displayWidth) {
      this.displayWidth = this.width - this.pixelCropLeft;// - Math.PI;
    }

    if (!this.displayHeight) {
      this.displayHeight = this.height - this.pixelCropTop;// - Math.PI;
    }
    this.loaded = true;
  }
}

module.exports = VideoTrack;
