var path = require('path');

module.exports = {
  entry: './src/JsWebm.js',
  mode: 'production',
  output: {
    library: 'JsWebm',
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, 'dist'),
    filename: 'JsWebm.js'
  }
};