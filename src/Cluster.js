'use strict';
var UNSET = -1;
var ElementHeader = require('./ElementHeader.js');
var SimpleBlock = require('./SimpleBlock.js');
class Cluster {

    constructor(offset, size, end, dataOffset, dataInterface, demuxer) {
        this.demuxer = demuxer; // reference to parent demuxer for passing data
        this.dataInterface = dataInterface;
        this.offset = offset;
        this.size = size;
        //if (end !== -1){
            this.end = end;
        //} 
        //else{
          //  this.end = Number.MAX_VALUE;
        //}
        this.dataOffset = dataOffset;
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
        this.timeCode = null;
        this.tempBlock = null;

        this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.tempBlock = new SimpleBlock();


        //this should go somewhere else!!
        //this.demuxer.loadedMetadata = true; // Testing only
        return true;
    }
    
    init(){
        
    }
    
    reset(){
       
    }
    
    load() {
        var status = false;

        while (this.dataInterface.offset < this.end) {
            if (!this.tempElementHeader.status) {
                this.dataInterface.peekAndSetElement(this.tempElementHeader);
                if (!this.tempElementHeader.status)
                    return null;
            }


            switch (this.tempElementHeader.id) {

                case 0xE7: //TimeCode
                    var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
                    if (timeCode !== null){
                        this.timeCode = timeCode;
                        //console.warn("timecode seeked to:" + this.timeCode);
                    }else{
                        return null;
                    }
                    break;

                case 0xA3: //Simple Block
                    if (!this.tempBlock.status)
                        this.tempBlock.init(
                                this.tempElementHeader.offset,
                                this.tempElementHeader.size,
                                this.tempElementHeader.end,
                                this.tempElementHeader.dataOffset,
                                this.dataInterface,
                                this
                                );
                    this.tempBlock.load();
                    if (!this.tempBlock.loaded)
                        return 0;
                    //else
                    //  this.blocks.push(this.tempBlock); //Later save positions for seeking and debugging
                    this.tempBlock.reset();

                    this.tempEntry = null;
                    this.tempElementHeader.reset();
                    if(this.dataInterface.offset !== this.end)
                        return true;
                    break;

                    //TODO, ADD VOID
                default:

                    //This means we probably are out of the cluster now, double check bounds when end not available
                    break;

            }

            this.tempEntry = null;
            this.tempElementHeader.reset();
            
            //return 1;
        }


        //if (this.dataInterface.offset !== this.end){
        //  console.log(this);
        //throw "INVALID CLUSTER FORMATTING";
        //}


        this.loaded = true;
        return status;
    }
}

module.exports = Cluster;

