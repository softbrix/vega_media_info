const fs = require('fs');
const MP4Box = require('mp4box');

const MIN_CHUNK = 64 * 1024;
const MAX_CHUNK = 1024 * 1024;

exports.info = function (filePath, callback) {
  var mp4boxfile = MP4Box.createFile();

  let stat = fs.statSync(filePath);
  const chunkSize = Math.round(Math.min(Math.max(stat.size/1000, MIN_CHUNK), MAX_CHUNK));
  var filereader = fs.createReadStream(filePath, { highWaterMark: chunkSize });
  var gotInfo = false;

  mp4boxfile.onReady = function (info) {
    gotInfo = true;
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
      if (filereader.bytesRead > 50 * MAX_CHUNK) {
        throw Error('To big meta for naive mp4box');
      }
      if (chunk) {
        var arrayBuffer = toArrayBuffer(chunk);
        arrayBuffer.fileStart = filePos;
        filePos += arrayBuffer.byteLength;
        mp4boxfile.appendBuffer(arrayBuffer);
      } else {
        mp4boxfile.flush();
      }
    } catch(e) {
      filereader.close();
      callback(e);
    }
  });

  filereader.on('end', () => {
    mp4boxfile.flush();
    if (!gotInfo) {
      callback('Failed to parse mp4');
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