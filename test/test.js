


var testFolder = '../matroska-test-files/test_files/';

var testflipFlop = true;
function flipFlop() {
  if (testflipFlop) {
    testflipFlop = false;
  } else {
    testflipFlop = true;
  }
  return testflipFlop;
}

function loadTest(n) {
  var fileRequest = new XMLHttpRequest();
  fileRequest.open("GET", testFolder + "test" + n + ".mkv", true);
  //fileRequest.open("GET", "/Wiki_Makes_Video_Intro_4_26.webm.720p.webm", true);
  fileRequest.responseType = "arraybuffer";

  fileRequest.onload = function (oEvent) {
    var arrayBuffer = fileRequest.response; // Note: not oReq.responseText
    if (arrayBuffer) {
      //var byteArray = new Arra(arrayBuffer);
      runTest(arrayBuffer);
    }
  };

  fileRequest.send(null);
}

function runTest(buffer) {
  var increment = 1;//4477;
  window.demuxer = new OGVDemuxerWebM();
  var pointer = 0;
  var start = pointer;
  pointer += increment;
  var end = pointer;
  //console.log(start + ":" + end);
  demuxer.receiveInput(buffer.slice(start, end), function () { });

  while (!demuxer.eof) {

    demuxer.process(function (status) {
      if (status === false /* && flipFlop() */) {
        //give more data
        start = pointer;
        pointer += increment;
        end = pointer;
        demuxer.receiveInput(buffer.slice(start, end), function () { });

        start = pointer;
        pointer += increment;
        end = pointer;
        demuxer.receiveInput(buffer.slice(start, end), function () { });
      }
    });

  }
  console.log(demuxer);
  /*
  var output = document.getElementById('output');
  //JSON.stringify(demuxer, null, 4);

  var cache = [];
  output.innerHTML =  JSON.stringify(demuxer, function (key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Circular reference found, discard key
              return;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  } , ' ');
  cache = null; // Enable garbage collection
  */
}

loadTest(1);