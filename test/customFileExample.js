const JsWebm = require('../src/JsWebm');
const CircularJSON = require('circular-json');

const fileRequest = new XMLHttpRequest();
fileRequest.open("GET", "./test/clock.webm", true);
fileRequest.responseType = "arraybuffer";

const runTest = (buffer) => {
	const demuxer = new JsWebm();
	demuxer.demux(buffer);
	document.getElementById('output').innerHTML = CircularJSON.stringify(demuxer, null, 2);
};

fileRequest.onload = (event) => {
	const arrayBuffer = fileRequest.response;
	if (arrayBuffer) {
		runTest(arrayBuffer);
	}
};

fileRequest.send(null);