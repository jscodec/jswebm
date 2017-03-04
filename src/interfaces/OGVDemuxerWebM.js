'use strict';
/**
 * Interface Implementation for OGV.js
 * Abstracts away Demuxer logic away from ogv logic!
 * 
 */
var JsWebm = require('../WebmDemuxer.js');

var getTimestamp;
if (typeof performance === 'undefined' || typeof performance.now === 'undefined') {
    getTimestamp = Date.now;
} else {
    getTimestamp = performance.now.bind(performance);
}

class OGVDemuxerWebM extends JsWebm{

    constructor(){
        super();
    }
    
     /**
     * 
     * @param {function} callback
     */
    init(callback) {

        callback();
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

    close() {
        //nothing for now
    }

    receiveInput(data, callback) {
        var ret = this.time(function () {
            //console.log("got input");
            //this.dataInterface.recieveInput(data);
            this.queueData(data);
        }.bind(this));
        callback();
    }

}

//Expose our new class to the window's global scope
if(window)
    window.OGVDemuxerWebM = OGVDemuxerWebM;

if(self)
    self.OGVDemuxerWebM = OGVDemuxerWebM;




