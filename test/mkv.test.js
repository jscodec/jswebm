const JsWebm = require('../src/JsWebm.js');
const fs = require('fs');
const path = require('path');

const runTestFile = i => {
  const demuxer = new JsWebm();
  const file = fs.readFileSync(path.join(__dirname, '..', `/matroska-test-files/test_files/test${i}.mkv`)).buffer;
  demuxer.queueData(file);
  while (!demuxer.eof) {
    demuxer.demux();
  }
  return demuxer;
};

test('Test first test file', () => {
  const demuxer = runTestFile(1);
  expect(demuxer.docType).toBe('matroska');
});