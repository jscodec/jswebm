'use strict';


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
 
    load(){
        
    }
    
}

module.exports = Tags;