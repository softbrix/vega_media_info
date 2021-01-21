const fs = require('fs');
const MP4Box = require('mp4box');

exports.info = function (filePath, callback) {
  var mp4boxfile = MP4Box.createFile();
  var filereader = fs.createReadStream(filePath);

  mp4boxfile.onReady = function (info) {
    try {
      filereader.close();
    } catch(e) {
      return callback(e);
    }
    callback(undefined, info);
  };

  var filePos = 0;
  filereader.on('readable', function () {
    try {
      var chunk = filereader.read();
      if (chunk) {
        var arrayBuffer = toArrayBuffer(chunk);
        arrayBuffer.fileStart = filePos;
        filePos += arrayBuffer.byteLength;
        mp4boxfile.appendBuffer(arrayBuffer);
      } else {
        mp4boxfile.flush();
      }
    } catch(e) {
      callback(e);
    }
  });
};

function toArrayBuffer(buffer) {
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
  }
  return ab;
}