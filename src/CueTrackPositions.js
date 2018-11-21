class CueTrackPositions {
  constructor(cuesPointHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = cuesPointHeader.offset;
    this.size = cuesPointHeader.size;
    this.end = cuesPointHeader.end;
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
        if (this.currentElement === null)
          return null;
      }
      switch (this.currentElement.id) {
        case 0xF7: // CueTrack
          var cueTrack = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueTrack !== null)
            this.cueTrack = cueTrack;
          else
            return null;
          break;
        case 0xF1: // Cue ClusterPosition 
          var cueClusterPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueClusterPosition !== null)
            this.cueClusterPosition = cueClusterPosition;
          else
            return null;
          break;
        case 0xF0: // CueRelativePosition
          var cueRelativePosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueRelativePosition !== null)
            this.cueRelativePosition = cueRelativePosition;
          else
            return null;
          break;
        default:
          console.warn("Cue track positions not found! " + this.currentElement.id);
          break;
      }
      this.currentElement = null;
    }
    if (this.dataInterface.offset !== this.end) {
      throw new Error('Invalid Seek Formatting');
    }
    this.loaded = true;
  }
}

module.exports = CueTrackPositions;
