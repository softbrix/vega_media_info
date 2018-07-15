/* jshint: node */

"use strict"
var fs = require('fs');
var path = require('path');

const ExifImage = require('exif').ExifImage; // This will read exif info
const iptc = require('node-iptc'); // This will only return the keywords tag
const xmpReader = require('kopparmora-xmp-reader'); // This will read xmp info
const jpgSize = require('./lib/jpgSize'); // This will read xmp info

const exif = require('./exiftool');
const regionInfoParser = require('./lib/regionInfo');

// Allways itpc:keywords
const tagHolderItpc = 'keywords';
const tagsDelimiter = ';';
const exifRegexp = /((j|m)pe?g|m4a|m4v|mp4|mov|avi)$/i;
const isImageRegexp = /(jpe?g|png|tiff|img)$/i;

function isImage(filePath) {
  return isImageRegexp.test(path.basename(filePath));
}

function hasExifInfo(filePath) {
  return exifRegexp.test(path.basename(filePath));
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
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
  if(isNumeric(date)) {
    return new Date(parseFloat(date)).toLocaleString();
  }
  return date;
};

let fileToBuffer = (file) => new Promise((resolve, reject) => {
	fs.readFile(file, (err, data) => {
	  if (err) return reject(err);
	  resolve(data);
	});
});

var processExifImage = function(sourceFile) {
  return fileToBuffer(sourceFile).then(processImageBuffer);
};

var exifImage = function(buffer) {
  return new Promise((resolve, reject) => {
    new ExifImage(buffer, function (error, exifData) {
        if (error) { return reject(error); }
        resolve(exifData);
    });
  });
}

var processImageBuffer = function(buffer) {
  // Different tools will read different meta information
  return Promise.all([
      exifImage(buffer),
      xmpReader.fromBuffer(buffer),
      iptc(buffer),
      jpgSize(buffer)]
    ).then(result => {
    var [exifData, xmpData, iptc, size] = result;
    size = size || {};
    iptc = iptc || {};
    return {
        CreateDate : normalizeDate(exifData.exif.CreateDate),
        ModifyDate : normalizeDate(exifData.image.ModifyDate),
        Width: size.width || exifData.image.ImageWidth || exifData.exif.ExifImageWidth ,
        Height: size.height || exifData.image.ImageHeight || exifData.exif.ExifImageHeight,
        Tags : xmpData.keywords || iptc.keywords || [],
        Regions: regionInfoParser.parse(xmpData),
        Type: 'exifImage',
        Raw : Object.assign(exifData, xmpData, iptc, size)
    };
  });
};

var processExifTool = function(fileName, tags) {
  if(tags === undefined) {
    tags = [];
  }
  return new Promise((resolve, reject) => {
    /** exiftool: */
    exif.metadata(fileName, tags, function(error, metadata) {
      if (error) {
        return reject(error);
      } else {
        if(Object.keys(metadata).length === 0) {
          return resolve({});
        }

        var createDate = metadata.createDate;
        if(createDate === undefined) {
          createDate = metadata['date/timeOriginal'];
        }
        if(createDate === undefined || createDate === '0000:00:00 00:00:00') {
          createDate = metadata['fileModificationDate/Time'];
        }
        var modifyDate = metadata.modifyDate;
        if(modifyDate === undefined || modifyDate === '0000:00:00 00:00:00') {
          modifyDate = createDate;
        }

        metadata.regionInfo = regionInfoParser.parse(metadata);

        resolve({
            CreateDate : normalizeDate(createDate),
            ModifyDate : normalizeDate(modifyDate),
            Width: metadata.imageWidth,
            Height: metadata.imageHeight,
            Tags : extractTags(metadata),
            Regions: metadata.regionInfo,
            Type: 'exifTool',
            Raw : metadata
        });
      }
    });
  });
};


// This should be the suggested date, more insecure than the exif info
var fileSystemFallback = function(fileName) {
  return new Promise((resolve, reject) => {
    fs.stat(fileName, function(error, stats) {
      if (error) {
          return reject(error);
      } else {
        resolve({
            CreateDate : stats.ctime,
            ModifyDate : stats.mtime,
            Tags: [],
            Type: 'system',
            Raw : stats
        });
      }
    });
  });
};

var saveTagsToFile = function(tags, sourceFile) {
  var newTagStr = tags.length > 0 ? tags.join(tagsDelimiter) : "";
  return processExifTool(sourceFile, ['-'+tagHolderItpc+'='+newTagStr, '-overwrite_original']);
};

var prepareExifToolArgs = function(obj, operator) {
  operator = operator || '=';
  return Object.entries(obj).map(ent => '-'+ent[0]+operator+ent[1]);
}

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
  readMediaInfo : function(filePath, useFallback) {
      if(hasExifInfo(filePath)) {
        if(isImage(filePath)) {
          // Exif image is much faster but only supports jpeg
          return processExifImage(filePath);
        } else if (useFallback) {
          // Exiftool is an external dependency and needs to be installed on the system
          return processExifTool(filePath);
        }
      } else if(useFallback) {
        return fileSystemFallback(filePath);
      }
      var extension = path.extname(filePath);
      return Promise.reject('File type not recognized: ' + extension);
  },

  // CRUD Tags
  addTag : function(sourceFile, newTag) {
    return this.getTags(sourceFile).then(
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
      });
  },
  removeTag : function(sourceFile, newTag) {
    return this.getTags(sourceFile).then(
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
    return this.readMediaInfo(sourceFile).then(info => info.Tags);
  },
  /*
  https://www.sno.phy.queensu.ca/~phil/exiftool/TagNames/MWG.html#RegionStruct
  A region must be defined some thing like this:
  {
    type: 'Face || Focus || Pet || BarCode',
    name: String,
    area: {
      x: float,
      y: float,
      w: float,
      h: float,
      unit: 'normalized'
    }
  }*/
  addRegion: function(sourceFile, newRegion) {
    if(newRegion === undefined || newRegion.area === undefined) {
      return Promise.reject('New regions must be valid');
    }
    let newRegionsExif = regionInfoParser.prepareArea(newRegion);
    let args = prepareExifToolArgs(newRegionsExif, '+=');
    return this.readMediaInfo(sourceFile).then(info => {
      if(Object.keys(info.Regions).length === 0) {
        let newRegionInfo = regionInfoParser.prepareDimensions(info.Width, info.Height);
        args = args.concat(prepareExifToolArgs(newRegionInfo));
      }
      return processExifTool(sourceFile, args);
    });
  },

/** Internal methods used for testing **/
  _processExifImage: processExifImage,
  _processExifTool: processExifTool,
  _processFileSystem: fileSystemFallback
};
