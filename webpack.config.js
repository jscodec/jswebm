const ClosureCompiler = require('google-closure-compiler-js').webpack;
const path = require('path');
 
var OGV = {
  entry: [
    path.join(__dirname, 'src', 'interfaces' , 'OGVDemuxerWebM.js' )
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'OGVDemuxer.js'
  }  
};

var OGVMin = {
  entry: [
    path.join(__dirname, 'src', 'interfaces' , 'OGVDemuxerWebM.js' )
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'ogv-demuxer-webm.js'
  },
  
  plugins: [
    new ClosureCompiler({
      options: {
        compilationLevel: 'SIMPLE',
        //warningLevel: 'VERBOSE'
      }
    })
  ]
  
};


module.exports = [OGVMin];