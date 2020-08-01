var path = require('path');

module.exports = {
  entry: './src/JsWebm.js',
  mode: 'production',
  output: {
    library: 'JsWebm',
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, 'dist'),
    filename: 'JsWebm.js'
  }
};