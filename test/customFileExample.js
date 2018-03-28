console.log('hello');
const fileRequest = new XMLHttpRequest();
fileRequest.open("GET", "PUT YOUR SAMPLE FILE HERE", true);
fileRequest.responseType = "arraybuffer";

const runTest = (buffer) =>{
const demuxer = new OGVDemuxerWebM();
    demuxer.receiveInput(buffer, () =>{
    	demuxer.process((status) => {
       		document.write(JSON.stringify(demuxer, null, 2));
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