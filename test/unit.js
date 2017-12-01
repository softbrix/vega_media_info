
const assert = require('assert');
const mediaInfo = require('../index.js');

describe('Vega Media Info', function() {
  var file = './test_data/img1.jpg';
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
    return mediaInfo.getTags(file).
        then(function(tags) {
          assert.deepEqual([], tags);
        });
  });

  it('should return information for simple image', function() {
    return mediaInfo.readMediaInfo(file).
        then(function(info) {
          assert.ok(info);
          assert.equal(info.CreateDate, info.ModifyDate);
          assert.equal(info.Width, 2272);
          assert.equal(info.Height, 1704);
          assert.equal(info.Type, 'exifImage');

          assert.ok(new Date(info.CreateDate));
        });
  });

  xit('should expose internal test methods', function() {
    return Promise.all([
      mediaInfo._processExifImage(file),
      mediaInfo._processExifTool(file),
      mediaInfo._processPiexifJS(file),
      mediaInfo._processFileSystem(file)
    ]).then(console.log);
  });

});
