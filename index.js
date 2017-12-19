/* jshint: node */

"use strict"
var fs = require('fs');
var path = require('path');
var Q = require('q');

var ExifImage = require('exif').ExifImage;
var iptc = require('node-iptc');
var piexif = require("piexifjs");
var exif = require('./exiftool');

// Allways itpc:keywords
const tagHolderItpc = 'keywords';
const tagsDelimiter = ';';
const isImageRegexp = /^(?!\.).+[jpe?g|png|tiff|img]$/i;

function isImage(filePath) {
  return isImageRegexp.test(path.basename(filePath))
}

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

var processExifImage = function(fileName) {
  var deffered = Q.defer();
  new ExifImage({ image : fileName}, function (error, exifData) {
      if (error) {
          fileSystemFallback(fileName).then(deffered.resolve, deffered.reject);
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

var processExifTool = function(fileName, tags) {
  if(tags === undefined) {
    tags = [];
  }
  var deffered = Q.defer();
  /** exiftool: */
  exif.metadata(fileName, tags, function(error, metadata) {
    if (error) {
      return deffered.reject(error);
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

var processPiexifJS = function(fileName) {
  var deffered = Q.defer();
  /** piexif: */
  fs.readFile(fileName, (err, jpeg) => {
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
var fileSystemFallback = function(fileName) {
  var deffered = Q.defer();
  fs.stat(fileName, function(error, stats) {
    if (error) {
        return deffered.reject(error);
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

var processFile = function(fileName) {
    var deffered = Q.defer();
    var exifRegexp = /^(?!\.).+[jpe?g|m4a|m4v|mp4|mov]$/i;

    var extension = path.extname(fileName);

    if(exifRegexp.test(path.basename(fileName))) {
      if(isImage(fileName)) {
        return processExifImage(fileName);
      } else if(true) {
        //console.log('Use exif tool');
        return processExifTool(fileName);
      } else {
        // TODO: Remove dependency
        return processPiexifJS(fileName);
      }
    } else {
      return fileSystemFallback(fileName);
    }

};

var read_iptc = function(sourceFile) {
  if(isImage(sourceFile)) {
    var deffered = Q.defer();
    fs.readFile(sourceFile, function(err, data) {
      if (err) { return deffered.reject(err); }
      var iptc_data = iptc(data);
      deffered.resolve(iptc_data);
    });
    return deffered.promise;
  } else {
    return processExifTool(sourceFile);
  }
};

var read_tags = function(sourceFile) {
  return read_iptc(sourceFile).then(function(iptc_data) {
    return extractTags(iptc_data) || [];
  }/*, function( error ) {
    return [];
  }*/);
};

var saveTagsToFile = function(tags, sourceFile) {
  var newTagStr = tags.length > 0 ? tags.join(tagsDelimiter) : "";
  return processExifTool(sourceFile, ['-'+tagHolderItpc+'='+newTagStr, '-overwrite_original']);
};

var extractTags = function(metadata) {
  var tags = [],
      tagString = metadata[tagHolderItpc];
  if(tagString !== undefined) {
    if(Array.isArray(tagString)) {
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
        if(Array.isArray(newTag)) {
          newTag.forEach(function(tag) {
            if(tags.indexOf(tag) < 0) {
              tags.push(tag);
            }
          });
        } else if (tags.indexOf(newTag) < 0) {
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
        if(tags.indexOf(newTag) >= 0) {
          tags = tags.filter(
            tag => tag.valueOf() !== '' && tag.valueOf() !== newTag.valueOf()
          );
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
