

var testFolder = '../matroska-test-files/test_files/';

var oReq = new XMLHttpRequest();
oReq.open("GET", testFolder + "test1.mkv", true);
oReq.responseType = "arraybuffer";

oReq.onload = function (oEvent) {
  var arrayBuffer = oReq.response; // Note: not oReq.responseText
  if (arrayBuffer) {
    //var byteArray = new Arra(arrayBuffer);
    runTest(arrayBuffer);
  }
};

oReq.send(null);


function runTest(buffer){
    var demuxer = new jswebm();
    demuxer.queueData(buffer);
    
    while(!demuxer.eof){
       demuxer.demux(); 
    }
    console.log(demuxer);
    
}