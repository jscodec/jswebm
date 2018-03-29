const JsWebm = require('../src/JsWebm');
const CircularJSON = require ('circular-json');

const fileRequest = new XMLHttpRequest();
fileRequest.open("GET", "clock.webm", true);
fileRequest.responseType = "arraybuffer";

const runTest = (buffer) =>{
	const demuxer = new JsWebm();
	demuxer.demux(buffer);
	console.log(demuxer);
};

fileRequest.onload = (event) => {
	const arrayBuffer = fileRequest.response;
	if (arrayBuffer) {
		runTest(arrayBuffer);
	}
};

fileRequest.send(null);