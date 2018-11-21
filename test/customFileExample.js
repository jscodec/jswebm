const JsWebm = require('../src/JsWebm');
const CircularJSON = require('circular-json');

const fileRequest = new XMLHttpRequest();



fileRequest.open("GET", "./test/clock.webm", true);
fileRequest.responseType = "arraybuffer";

const runTest = (buffer) => {
  const demuxer = new JsWebm();
  demuxer.queueData(buffer);
  while (!demuxer.eof) {
    demuxer.demux();
  }
  console.log(demuxer);
  console.log(`total video packets : ${demuxer.videoPackets.length}`);
  console.log(`total audio packets : ${demuxer.audioPackets.length}`);
  document.getElementById('output').innerHTML = CircularJSON.stringify(demuxer, null, 2);
};

fileRequest.onload = (event) => {
  const arrayBuffer = fileRequest.response;
  if (arrayBuffer) {
    runTest(arrayBuffer);
  }
};

fileRequest.send(null);