
const assert = require('assert');
const mediaInfo = require('../index.js');

describe('Vega Media Info', function() {
  var jpg_file = './test_data/img1.jpg';
  var mov_file = './test_data/test.mov';
  var no_file = './test_data/no_file.jpg';

  it('should return reject if no image found', function() {
    return mediaInfo.getTags(no_file).
        then(function(tags) {
          assert.fail('Should reject if no image found');
        }, function(error) {
          assert.ok(error);
        });
  });

  it('should return empty array for simple image', function() {
    return mediaInfo.getTags(jpg_file).
        then(function(tags) {
          assert.deepEqual([], tags);
        });
  });

  it('should return be able to add tag to simple image', function() {
    var TAG = 'Test tag';
    return mediaInfo.addTag(jpg_file, TAG).
        then(function() {
          return mediaInfo.getTags(jpg_file).
             then(function(tags) {
               assert.deepEqual([TAG], tags);
             });
        });
  });

  it('should return be able to remove tag from simple image', function() {
    var TAG = 'Test tag';
    return mediaInfo.removeTag(jpg_file, TAG).
        then(function() {
          return mediaInfo.getTags(jpg_file).
             then(function(tags) {
               assert.deepEqual([], tags);
             });
        });
  });

  it('should return information for simple .JPG image', function() {
    return mediaInfo.readMediaInfo(jpg_file).
        then(function(info) {
          assert.ok(info);
          assert.equal(info.CreateDate, info.ModifyDate);
          assert.equal(info.Width, 2272);
          assert.equal(info.Height, 1704);
          assert.equal(info.Type, 'exifImage');

          assert.ok(new Date(info.CreateDate));
        });
  });

  it('should return information for simple .MOV file', function() {
    return mediaInfo.readMediaInfo(mov_file).
        then(function(info) {
          assert.ok(info);
          assert.equal(info.CreateDate, info.ModifyDate);
          assert.equal(info.Width, 1920);
          assert.equal(info.Height, 1080);
          assert.equal(info.Type, 'exifTool');

          assert.ok(new Date(info.CreateDate));
        });
  });

  xit('should expose internal test methods', function() {
    return Promise.all([
      mediaInfo._processExifImage(jpg_file),
      mediaInfo._processExifTool(jpg_file),
      mediaInfo._processPiexifJS(jpg_file),
      mediaInfo._processFileSystem(jpg_file)
    ]).then(console.log);
  });

});
