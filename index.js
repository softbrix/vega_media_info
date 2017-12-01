/* jshint: node */

"use strict"
var _ = require('underscore');
var fs = require('fs-extra');
var path = require('path');
var Q = require('q');

var ExifImage = require('exif').ExifImage;
var iptc = require('node-iptc');
var piexif = require("piexifjs");
var exif = require('./exiftool');

// Allways itpc:keywords
const tagHolderItpc = 'keywords';
const tagsDelimiter = ';';
const isImage = /^(?!\.).+[jpe?g|png|tiff|img]$/i;

// ex: 2015:12:11 12:10:09
const dateRegexp = /^([\d]{2,4}).?(\d{1,2}).?(\d{1,2})\s(\d{1,2}).?(\d{1,2}).?(\d{1,2})/;

// The exif date is not compatible with the js date format and needs to be transformed
var normalizeDate = function(date) {
  var d = dateRegexp.exec(date);
  if(d) {
    if(d.length > 3) {
      return new Date(d[1], d[2]-1, d[3], d[4], d[5], d[6], 0).toLocaleString();
    }
  }
  return date;
};

var processExiftool = function(filename, tags, callback) {
  var deffered = Q.defer();

//console.log("process", filename);
  exif.metadata(filename, tags, function(error, metadata) {
    if (error) {
      deffered.reject(error);
    } else {
      deffered.resolve(metadata);
    }
    if(_.isFunction(callback)) {
      callback(error, metadata);
    }
  });
  return deffered.promise;
};

var processExifImage = function(item) {
  var deffered = Q.defer();
  new ExifImage({ image : item}, function (error, exifData) {
      if (error) {
          fileSystemFallback(item).then(deffered.resolve, deffered.reject);
      } else {
        deffered.resolve({
            CreateDate : normalizeDate(exifData.exif.CreateDate),
            ModifyDate : normalizeDate(exifData.image.ModifyDate),
            Width: exifData.exif.ExifImageWidth,
            Height: exifData.exif.ExifImageHeight,
            //Tags : exifData.image.XPKeywords,
            Type: 'exifImage',
            origInfo : exifData
        });
      }
  });
  return deffered.promise;
};

var processExifTool = function(item) {
  var deffered = Q.defer();
  /** exiftool: */
  processExiftool(item, [], function(error, metadata) {
    if (error) {
      deffered.reject(error);
    } else {
      deffered.resolve({
          CreateDate : normalizeDate(metadata.createDate),
          ModifyDate : normalizeDate(metadata.modifyDate),
          Width: metadata.imageWidth,
          Height: metadata.imageHeight,
          Tags : extractTags(metadata),
          Type: 'exifTool',
          origInfo : metadata
      });
    }
  });
  return deffered.promise;
};

var processPiexifJS = function(item) {
  var deffered = Q.defer();
  /** piexif: */
  fs.readFile(item, (err, jpeg) => {
    if(err) {
      return deffered.reject(err);
    }
    var data = jpeg.toString("binary");
    var exifData = piexif.load(data);
    deffered.resolve({
        CreateDate : normalizeDate(exifData.Exif[36867]),
        ModifyDate : normalizeDate(exifData.Exif[36868]),
        Width: exifData.Exif[40962],
        Height: exifData.Exif[40963],
        Tags : [],
        Type: 'piexif',
        origInfo : exifData
    });
  });

  return deffered.promise;
}


// This should be the suggested date, more insecure than the exif info
var fileSystemFallback = function(item) {
  var deffered = Q.defer();
  fs.stat(item, function(error, stats) {
    if (error) {
        deffered.reject(error);
    } else {
      deffered.resolve({
          CreateDate : stats.ctime,
          ModifyDate : stats.mtime,
          Tags: [],
          Type: 'system',
          origInfo : stats
      });
    }
  });
  return deffered.promise;
};

var processFile = function(item) {
    var deffered = Q.defer();
    var exifRegexp = /^(?!\.).+[jpe?g|m4a|mp4]$/i;

    var extension = path.extname(item);

    if(exifRegexp.test(path.basename(item))) {
      if(isImage.test(path.basename(item))) {
        return processExifImage(item);
      } else if(true) {
        //console.log('Use exif tool');
        return processExifTool(item);
      } else {
        return processPiexifJS(item);
      }
    } else {
      return fileSystemFallback(item);
    }

};

var read_iptc = function(sourceFile) {
  var deffered = Q.defer();
  if(isImage.test(sourceFile)) {
    fs.readFile(sourceFile, function(err, data) {
      if (err) { deffered.reject(err); }
      var iptc_data = iptc(data);
      deffered.resolve(iptc_data);
    });
  } else {
    processExiftool(sourceFile, function(err, data) {
      if (err) {
         deffered.reject(err);
       } else {
         deffered.resolve(data);
      }
    });
  }
  return deffered.promise;
};

var read_tags = function(sourceFile) {
  return read_iptc(sourceFile).then(function(iptc_data) {
    return extractTags(iptc_data) || [];
  }/*, function( error ) {
    return [];
  }*/);
};

var saveTagsToFile = function(tags, sourceFile) {
  var deffered = Q.defer();
  var newTagStr = tags.length > 0 ? tags.join(tagsDelimiter) : "";
  processExiftool(sourceFile, ['-'+tagHolderItpc+'='+newTagStr, '-overwrite_original'], function(err /*, ignore */) {
    //console.log('tags added', ignore);
    if (err) {
       deffered.reject(err);
     } else {
       deffered.resolve();
    }
  });
  return deffered.promise;
};

var extractTags = function(metadata) {
  var tags = [],
      tagString = metadata[tagHolderItpc];
  if(tagString !== undefined) {
    if(_.isArray(tagString)) {
      tagString = tagString[0];
    }
    tags = tagString.split(tagsDelimiter);
  }
  return tags;
};

module.exports = {
  readMediaInfo : function(sourceFile) {
    return processFile(sourceFile);
  },

  // CRUD Tags
  addTag : function(sourceFile, newTag) {
    return read_tags(sourceFile).then(
      function(tags) {
        var tagCountStart = tags.length;
        if(_.isArray(newTag)) {
          _.each(newTag, function(tag) {
            if(!_.contains(tags, tag)) {
              tags.push(tag);
            }
          });
        } else if (!_.contains(tags, newTag)) {
            tags.push(newTag);
        }
        if (tagCountStart !== tags.length) {
          return saveTagsToFile(tags, sourceFile);
        }
        return Q.resolve();
      });
  },
  removeTag : function(sourceFile, newTag) {
    return read_tags(sourceFile).then(
      function(tags) {
        if(_.contains(tags, newTag)) {
          tags = _.filter(tags, function(item) {
            return item.valueOf() !== '' && item.valueOf() !== newTag.valueOf();
          });
          return saveTagsToFile(tags, sourceFile);
        }
      });
  },
  getTags : function(sourceFile) {
    return read_tags(sourceFile);
  },

/** Internal methods used for testing **/
  _processExifImage: processExifImage,
  _processExifTool: processExifTool,
  _processPiexifJS: processPiexifJS,
  _processFileSystem: fileSystemFallback
};
