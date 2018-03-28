const JsWebm = require('../src/JsWebm');
const CircularJSON = require ('circular-json');

const fileRequest = new XMLHttpRequest();
fileRequest.open("GET", "matroska-test-files/test_files/test1.mkv", true);
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