var fs = require('fs');
var MP4Box = require('mp4box');

exports.info = function (filePath, callback) {
  // Callback should be triggered only once
  let callbackTriggered = false;
  const callbackHandler = function(err, info) {
    if (!callbackTriggered) {
      callbackTriggered = true;
      callback(err, info)
    }
  }

  var mp4boxfile = MP4Box.createFile();
  var arrayBuffer = new Uint8Array(fs.readFileSync(filePath)).buffer;
  arrayBuffer.fileStart = 0;
  mp4boxfile.onError = callbackHandler;
  mp4boxfile.onReady = (info) => { callbackHandler(undefined, info); };
  mp4boxfile.appendBuffer(arrayBuffer);
  // Mp4box is syncronous so either onError or onReady should have been called if mov block was found.
  callbackHandler('No MOV block found');
};
