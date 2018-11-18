class SimpleTag {
  constructor(simpleTagHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = simpleTagHeader.offset;
    this.size = simpleTagHeader.size;
    this.end = simpleTagHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTrack = null;
    this.cueClusterPosition = 0;
    this.cueRelativePosition = 0;
    this.tagName = null;
    this.tagString = null;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null)
          return null;
      }
      switch (this.currentElement.id) {
        case 0x45A3: //TagName
          var tagName = this.dataInterface.readString(this.currentElement.size);
          if (tagName !== null)
            this.tagName = tagName;
          else
            return null;
          break;
        case 0x4487: //TagString
          var tagString = this.dataInterface.readString(this.currentElement.size);
          if (tagString !== null)
            this.tagString = tagString;
          else
            return null;
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size))
            return false;
          else
            this.dataInterface.skipBytes(this.currentElement.size);
          console.warn("simple tag element not found ! : " + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end)
      console.error("Invalid Targets Formatting");
    this.loaded = true;
  }
}

module.exports = SimpleTag;
