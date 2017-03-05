'use strict';

var Tag = require('./Tag.js');

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
                case 0xB7: //Cue Track Positions
                    if (!this.cueTrackPositions)
                        this.cueTrackPositions = new CueTrackPositions(this.currentElement, this.dataInterface);
                    this.cueTrackPositions.load();
                    if (!this.cueTrackPositions.loaded)
                        return;
                    break;




                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);


                    console.warn("tag Point not found, skipping" + this.currentElement.id.toString(16) );
                    break;

            }

            this.currentElement = null;
        }

        this.loaded = true;
    }

}

module.exports = Tags;