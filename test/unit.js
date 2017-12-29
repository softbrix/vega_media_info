
const assert = require('assert');
const mediaInfo = require('../index.js');

describe('Vega Media Info', function() {
  var jpg_file = './test_data/img1.jpg';
  var jpg_time_file = './test_data/timestamp.jpg';
  var mov_file = './test_data/test.mov';
  var no_exif_file = './test_data/file.txt';
  var no_file = './test_data/no_file.jpg';
  var corrupt_file = './test_data/corrupt.jpg';

  it('should return reject if no image found', function() {
    return mediaInfo.getTags(no_file).
        then(function(tags) {
          assert.fail('Not rejected');
        }, function(error) {
          assert.ok(error);
        });
  });

  it('should return reject if failed to parse image', function() {
    return mediaInfo.readMediaInfo(corrupt_file).
        then(function(info) {
          assert.fail('Not rejected');
        }, function(error) {
          assert.ok(error);
        });
  });

  it('should only use file system fallback if argument is set', function() {
    var no_argument_promise = mediaInfo.readMediaInfo(no_exif_file).
        then(function(tags) {
          console.error(tags);
          assert.fail('Not rejected');
        }, function(error) {
          assert.ok(error);
        });
    let with_argument_promise = mediaInfo.readMediaInfo(no_exif_file, true).
        then(function(tags) {
          assert.ok(tags);
        }, function(error) {
          assert.fail('Should have used file system as fallback');
        });
    return Promise.all([no_argument_promise, with_argument_promise]);
  });

  it('should return empty array for simple image', function() {
    return mediaInfo.getTags(jpg_file).
        then(function(tags) {
          assert.deepEqual([], tags);
        });
  });

  it('should be able to add tag to simple image', function() {
    var TAG = 'Test tag';
    return mediaInfo.addTag(jpg_file, TAG).
        then(function() {
          return mediaInfo.getTags(jpg_file).
             then(function(tags) {
               assert.deepEqual([TAG], tags);
             });
        });
  });

  it('should be able to remove tag from simple image', function() {
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

  it('should return information for simple .JPG image with timestamp', function() {
    return mediaInfo.readMediaInfo(jpg_time_file).
        then(function(info) {
          assert.ok(info);
          assert.equal(info.CreateDate, undefined);
          assert.equal(info.ModifyDate, '2017-1-8 00:57:52');
          assert.equal(info.Width, 3660);
          assert.equal(info.Height, 10194);
          assert.equal(info.Type, 'exifImage');
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

  xit('should return information for simple .AVI file', function() {
    return mediaInfo.readMediaInfo('./test_data/file.AVI').
        then(function(info) {
          assert.ok(info);

          //assert.equal(info.CreateDate, info.ModifyDate);
          assert.equal(info.Width, 640);
          assert.equal(info.Height, 480);
          assert.equal(info.Type, 'exifTool');

          assert.ok(new Date(info.CreateDate));

        });
  });

  xit('should expose internal test methods', function() {
    var file = jpg_file;
    return Promise.all([
      mediaInfo._processExifImage(file),
      mediaInfo._processExifTool(file),
      mediaInfo._processFileSystem(file)
    ]).then(console.log);
  });

  xit('should be fast', function() {
    var file = jpg_file;
    var count = 0;
    const LIMIT = 100;

    return new Promise(function(resolve, reject) {
      var process = function() {
        // ExifImage does the processing in less than a second
          mediaInfo._processExifImage(file)
          // Exif tool requires a lot more
        // mediaInfo._processExifTool(file)
        //    mediaInfo._processFileSystem(file)
        .then(function() {
          console.log(count);
          if(++count > LIMIT) {
            resolve('done');
          } else {
            setTimeout(process,0);
          }
        }, reject);
      };
      process();
    });
  });

});
