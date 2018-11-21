class Targets {
  constructor(targetsHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = targetsHeader.offset;
    this.size = targetsHeader.size;
    this.end = targetsHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTrack = null;
    this.cueClusterPosition = 0;
    this.cueRelativePosition = 0;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        case 0x63C5: // tagTrackUID
          var tagTrackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (tagTrackUID !== null) this.tagTrackUID = tagTrackUID;
          else
            return null;
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn("targets element not found ! : " + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end)
      console.error('Invalid Targets Formatting');
    this.loaded = true;
  }
}

module.exports = Targets;
