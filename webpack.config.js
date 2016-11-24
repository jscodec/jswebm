const ClosureCompiler = require('google-closure-compiler-js').webpack;
const path = require('path');
 
module.exports = {
  entry: [
    path.join(__dirname, 'src', 'interfaces' , 'OGVDemuxer.js' )
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'OGVDemuxer.js'
  },
  plugins: [
    new ClosureCompiler({
      options: {
        //languageIn: 'ECMASCRIPT6',
        //languageOut: 'ECMASCRIPT5',
        compilationLevel: 'ADVANCED',
        warningLevel: 'VERBOSE'
      }
    })
  ]
};

//./src/interfaces/OGVDemuxer.js ./build/OGVDemuxer.js