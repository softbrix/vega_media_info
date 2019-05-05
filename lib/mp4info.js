var fs = require('fs');
var MP4Box = require('mp4box');

exports.info = function (filePath, callback) {
  var mp4boxfile = MP4Box.createFile();
  var arrayBuffer = new Uint8Array(fs.readFileSync(filePath)).buffer;
  arrayBuffer.fileStart = 0;
  mp4boxfile.onError = callback;
  mp4boxfile.onReady = function (info) { callback(undefined, info); };
  mp4boxfile.appendBuffer(arrayBuffer);
};
