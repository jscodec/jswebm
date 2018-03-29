const path = require('path');

module.exports = {
  entry: [
  path.join(__dirname, 'test', 'customFileExample.js' )
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'customFileExample.js'
  }, 
  module:{
    rules:[
    {
      test: /\.(js|jsx)$/,
      loaders: 'babel-loader',
      exclude: /node_modules/,
    }
    ]
  }
};