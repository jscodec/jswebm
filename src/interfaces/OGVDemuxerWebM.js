'use strict';
/**
 * Interface Implementation for OGV.js
 * Abstracts away Demuxer logic away from ogv logic!
 * 
 */
var Demuxer = require('../WebmDemuxer.js');

var getTimestamp;
if (typeof performance === 'undefined' || typeof performance.now === 'undefined') {
    getTimestamp = Date.now;
} else {
    getTimestamp = performance.now.bind(performance);
}

class OGVDemuxer {

    constructor() {
        this.demuxer = new Demuxer();
    }

    /**
     * 
     * @param {function} callback
     */
    init(callback) {

        callback();
    }

    close() {
        //nothing for now
    }

    /**
     * Clear the current packet buffers and reset the pointers for new read position.
     * Should only need to do this once right before we send a seek request.
     * 
     * Needs to be cleaned up, Don't call so many times
     * @param {function} callback after flush complete
     */
    flush(callback) {
        //nop
        callback();
    }
    
    receiveInput(data, callback) {
        var ret = this.time(function () {
            //console.log("got input");
            this.demuxer.dataInterface.recieveInput(data);
        }.bind(this));
        callback();

    }

    /**
     * Times a function call
     */
    time(func) {
        var start = getTimestamp(),
                ret;
        ret = func();
        var delta = (getTimestamp() - start);
        this.cpuTime += delta;
        //console.log('demux time ' + delta);
        return ret;
    }

}

//Expose our new class to the window's global scope


if(window)
    window.OGVDemuxer = OGVDemuxer;

if(self)
    self.OGVDemuxer = OGVDemuxer;

