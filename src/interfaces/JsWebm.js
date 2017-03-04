var jswebm = require('../WebmDemuxer.js');

//Expose our new class to the window's global scope
if(window)
    window.jswebm = jswebm;

if(self)
    self.jswebm = jswebm;
