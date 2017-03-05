

var testFolder = '../matroska-test-files/test_files/';

var fileRequest = new XMLHttpRequest();
fileRequest.open("GET", testFolder + "test1.mkv", true);
fileRequest.responseType = "arraybuffer";

fileRequest.onload = function (oEvent) {
  var arrayBuffer = fileRequest.response; // Note: not oReq.responseText
  if (arrayBuffer) {
    //var byteArray = new Arra(arrayBuffer);
    runTest(arrayBuffer);
  }
};

fileRequest.send(null);


function runTest(buffer){
    var demuxer = new jswebm();
    demuxer.queueData(buffer);
    
    while(!demuxer.eof){
       demuxer.demux(); 
    }
    console.log(demuxer);
    var output = document.getElementById('output');
   
}

