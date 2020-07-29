var path = require('path');

module.exports = {
  entry: './src/JsWebm.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'JsWebm.js'
  }
};