const fileRequest = new XMLHttpRequest();
fileRequest.open("GET", "PUT YOUR SAMPLE FILE HERE", true);
fileRequest.responseType = "arraybuffer";

const runTest = (buffer) =>{
	const demuxer = new OGVDemuxerWebM();
	demuxer.receiveInput(buffer, () =>{
		demuxer.process((status) => {
			console.log(demuxer);
		}); 
	});
};

fileRequest.onload = (event) => {
	const arrayBuffer = fileRequest.response;
	if (arrayBuffer) {
		runTest(arrayBuffer);
	}
};

fileRequest.send(null);