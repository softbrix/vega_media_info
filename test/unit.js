
const assert = require('assert');
const fs = require('fs');
const mediaInfo = require('../index.js');

describe('Vega Media Info', function () {
  var jpgFile = './test_data/img1.jpg';
  var jpgFileCopy = './test_data/img1_cpy.jpg';
  var jpgTimeFile = './test_data/timestamp.jpg';
  var movFile = './test_data/test.mov';
  var noExifFile = './test_data/file.txt';
  var noFile = './test_data/no_file.jpg';
  var corruptFile = './test_data/corrupt.jpg';
  var fresh = './test_data/fresh.jpg';

  fs.copyFileSync(jpgFile, jpgFileCopy);

  describe('readMediaInfo', function () {
    it('should reject if failed to parse image', function () {
      return mediaInfo.readMediaInfo(corruptFile)
        .then(function (info) {
          assert.fail('Not rejected');
        }, function (error) {
          assert.ok(error);
        });
    });

    it('should return information for simple .JPG image', function () {
      return mediaInfo.readMediaInfo(jpgFile)
        .then(function (info) {
          assert.ok(info);
          assert.equal(info.CreateDate, info.ModifyDate);
          // This size is stored in the exif information is wrong, the actual image is smaller, should have looked at the canvas
          assert.equal(info.Width, 480);
          assert.equal(info.Height, 360);
          assert.equal(info.Mime, 'image/jpeg');
          assert.equal(info.Type, 'exifImage');
          let thumb = mediaInfo.getEncodedThumbnail(info);
          assert.equal(thumb.startsWith('data:image/jpeg;base64,/9j/2wCEAAkGBggGBQkIBwgKCQkLDRYPDQwMDRwTFRAW'), true);
          assert.equal(thumb.length, 7287);

          assert.ok(new Date(info.CreateDate));
        });
    });

    it('should return information for simple .JPG image with timestamp', function () {
      return mediaInfo.readMediaInfo(jpgTimeFile)
        .then(function (info) {
          assert.ok(info);
          assert.equal(info.CreateDate, undefined);
          assert.equal(info.ModifyDate, new Date(1483833472653).toLocaleString());
          assert.equal(info.Width, 3660);
          assert.equal(info.Height, 10194);
          assert.equal(info.Mime, 'image/jpeg');
          assert.equal(info.Type, 'exifImage');
        });
    });

    it('should return information for simple .MOV file', function () {
      return mediaInfo.readMediaInfo(movFile, true)
        .then(function (info) {
          assert.ok(info);
          assert.equal(info.CreateDate, info.ModifyDate);
          assert.equal(info.Width, 1920);
          assert.equal(info.Height, 1080);
          assert.equal(info.Mime, 'video/mp4');
          assert.equal(info.Type, 'mp4');
          assert.equal(info.Thumnail, undefined);

          assert.ok(new Date(info.CreateDate));
        });
    });

    it('should only use file system fallback if argument is set', function () {
      var noArgumentPromise = mediaInfo.readMediaInfo(noExifFile)
        .then(function (tags) {
          console.error(tags);
          assert.fail('Not rejected');
        }, function (error) {
          assert.ok(error);
        });
      let withArgumentPromise = mediaInfo.readMediaInfo(noExifFile, true)
        .then(function (tags) {
          assert.ok(tags);
        }, function () {
          assert.fail('Should have used file system as fallback');
        });
      return Promise.all([noArgumentPromise, withArgumentPromise]);
    });
  });

  describe('tags', () => {
    it('should reject if no image found', function () {
      return mediaInfo.getTags(noFile)
        .then(function (tags) {
          assert.fail('Not rejected');
        }, function (error) {
          assert.ok(error);
        });
    });

    it('should return empty array for simple image', function () {
      return mediaInfo.getTags(jpgFile)
        .then(function (tags) {
          assert.deepEqual([], tags);
        });
    });

    it('should be able to add tag to simple image', function () {
      var TAG = 'Test tag';
      return mediaInfo.addTag(jpgFile, TAG)
        .then(function () {
          return mediaInfo.getTags(jpgFile)
            .then(function (tags) {
              assert.deepEqual([TAG], tags);
            });
        });
    });

    it('should be able to remove tag from simple image', function () {
      var TAG = 'Test tag';
      return mediaInfo.removeTag(jpgFile, TAG)
        .then(function () {
          return mediaInfo.getTags(jpgFile)
            .then(function (tags) {
              assert.deepEqual([], tags);
            });
        });
    });
  });

  describe('addRegion', function () {
    let newRegion = {
      type: 'Face',
      name: 'John Doe',
      area: {
        x: 0.01,
        y: 0.01,
        w: 0.05,
        h: 0.05,
        unit: 'normalized'
      }
    };

    it('add new region', function () {
      return mediaInfo.readMediaInfo(fresh)
        .then(info => assert.deepEqual({}, info.Regions))
        .then(() => {
          return mediaInfo.addRegion(fresh, newRegion);
        })
        .then(() => { return mediaInfo.readMediaInfo(fresh); })
        .then(info => assert.equal(1, info.Regions.regionList.length));
    });
  });

  describe('rating', () => {
    it('should return rating for simple .JPG image', async function () {
      var info = await mediaInfo.readMediaInfo(jpgFileCopy);
      assert.equal(info.UserRating, undefined);
    });

    it('should set rating for simple .JPG image', async function () {
      let newRating = 4;
      var info = await mediaInfo.setRating(jpgFileCopy, newRating);
      // assert.equal(info.UserRating, newRating);
      info = await mediaInfo.readMediaInfo(jpgFileCopy);
      assert.equal(info.UserRating, newRating);
    });

    it('should report error if input is not a floating number', async function () {
      try {
        await mediaInfo.setRating(jpgFileCopy, 'abc');
        assert.fail('Expected an error');
      } catch (ex) {
        assert.ok(ex.message.startsWith('Invalid input,'));
      }
    });

    it('should report error if input is not found', async function () {
      try {
        await mediaInfo.setRating(noFile, 4);
        assert.fail('Expected an error');
      } catch (ex) {
        assert.ok(ex.startsWith('No file specified'));
      }
    });
  });

  xit('should return information for simple .AVI file', function () {
    return mediaInfo.readMediaInfo('./test_data/file.AVI')
      .then(function (info) {
        assert.ok(info);

        // assert.equal(info.CreateDate, info.ModifyDate);
        assert.equal(info.Width, 640);
        assert.equal(info.Height, 480);
        assert.equal(info.Type, 'exifTool');

        assert.ok(new Date(info.CreateDate));
      });
  });

  it('should expose internal test methods', function () {
    var file = jpgFile;
    return Promise.all([
      mediaInfo._processExifImage(file),
      mediaInfo._processExifTool(file)
      // mediaInfo._processFileSystem(file)
    ]).then(([a, b]) => {
      let eqFields = [
        'CreateDate',
        'Width',
        'Height',
        'CameraBrand',
        'CameraModel',
        'Orientation',
        'Flash',
        'UserRating'
      ];
      eqFields.forEach(field => {
        assert.equal(a[field], b[field], field);
      });
      assert.deepEqual(a.Tags, b.Tags);
      assert.deepEqual(a.Regions, b.Regions);
    });
  });

  it('should handle undefined thumbnail', function () {
    assert.equal(mediaInfo.getEncodedThumbnail({}), undefined);
  });

  it('should be fast', function () {
    var file = jpgFile;
    var count = 0;
    const LIMIT = 100;

    return new Promise(function (resolve, reject) {
      var process = function () {
        // ExifImage does the processing in less than a second
        mediaInfo._processExifImage(file)
          // Exif tool requires a lot more
        // mediaInfo._processExifTool(file)
        //    mediaInfo._processFileSystem(file)
          .then(function (info) {
          // console.log(count, info);
            if (++count > LIMIT) {
              resolve();
            } else {
              setTimeout(process, 0);
            }
          }, reject);
      };
      process();
    });
  });
});
