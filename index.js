/* jshint: node */

'use strict';
var fs = require('fs');
var path = require('path');

const metaReader = require('hemmesta-jpeg-meta'); // This will extract meta blocks from JPEG
const ExifImage = require('exif').ExifImage; // This will read exif info
const iptc = require('node-iptc'); // This will only return the keywords tag
const xmpReader = require('kopparmora-xmp-reader'); // This will read xmp info
const jpgSize = require('./lib/jpgSize'); // This will read xmp info
const mp4Info = require('./lib/mp4info');
const exiftool = require('./lib/exiftool');
const regionInfoParser = require('./lib/regionInfo');

// First two bytes which defines a jpg
const JPG_HEADER_BUFFER = Buffer.from([0xFF, 0xD8]);
const IPTC_BLOCK_MARKER = '237'; // 0xED

// Allways itpc:keywords
const tagHolderItpc = 'keywords';
const tagsDelimiter = ';';
const isMp4Regexp = /((m)pe?g|m4a|m4v|mp4|mov)$/i;
const exifRegexp = /((j|m)pe?g|m4a|m4v|mp4|mov|avi)$/i;
const isImageRegexp = /(jpe?g|png|tiff|img)$/i;

function isImage (filePath) {
  return isImageRegexp.test(path.basename(filePath));
}

function hasExifInfo (filePath) {
  return exifRegexp.test(path.basename(filePath));
}

function isMp4Video (filePath) {
  return isMp4Regexp.test(path.basename(filePath));
}

function isNumeric (n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// ex: 2015:12:11 12:10:09
const dateRegexp = /^([\d]{2,4}).?(\d{1,2}).?(\d{1,2})\s(\d{1,2}).?(\d{1,2}).?(\d{1,2})/;

// The exif date is not compatible with the js date format and needs to be transformed
var normalizeDate = function (date) {
  var d = dateRegexp.exec(date);
  if (d) {
    if (d.length > 3) {
      return new Date(d[1], d[2] - 1, d[3], d[4], d[5], d[6], 0).toLocaleString();
    }
  }
  if (isNumeric(date)) {
    return new Date(parseFloat(date)).toLocaleString();
  }
  return date;
};

var exifImage = function (buffer) {
  return new Promise((resolve, reject) => {
    ExifImage(buffer, function (error, exifData) {
      if (error) { return reject(error); }
      resolve(exifData);
    });
  });
};

function getExifBuffer (blocks) {
  if (blocks.Exif) {
    return Buffer.concat([JPG_HEADER_BUFFER, blocks.Exif]);
  }
  return JPG_HEADER_BUFFER;
}

function getXMPBuffer (blocks) {
  let key = Object.keys(blocks).find((x) => x.startsWith('http://ns.adobe.com/xap/1'));
  if (key) {
    return blocks[key];
  }
  return JPG_HEADER_BUFFER;
}

function getIPTCBuffer (blocks) {
  if (blocks[IPTC_BLOCK_MARKER]) {
    return Buffer.concat([JPG_HEADER_BUFFER, blocks[IPTC_BLOCK_MARKER]]);
  }
  return JPG_HEADER_BUFFER;
}

function extractExifThumbnail (exifInfo, exifBuffer) {
  if (exifInfo.thumbnail) {
    let tData = exifInfo.thumbnail;
    // Offset and skip first 0xFF 0xD8
    let start = exifBuffer.indexOf(0xD8, tData.ThumbnailOffset + 2) - 1;
    let end = start + tData.ThumbnailLength;

    let thumbnailBuffer = exifBuffer.slice(start, end);

    return {
      width: tData.XResolution,
      height: tData.YResolution,
      buffer: thumbnailBuffer,
      base64: function () {
        return 'data:image/jpeg;base64,' + thumbnailBuffer.toString('base64');
      }
    };
  }
}

var processExifImage = async function (sourceFile) {
  try {
    let metaBlocks = await metaReader(sourceFile);
    if (!metaBlocks) {
      console.log('No result');
      return {};
    }
    // Different tools will read different meta information
    var exifBuffer = getExifBuffer(metaBlocks);
    return Promise.all([
      exifImage(exifBuffer),
      xmpReader.fromBuffer(getXMPBuffer(metaBlocks)),
      iptc(getIPTCBuffer(metaBlocks)),
      jpgSize(metaBlocks)]
    ).then(result => {
      var [exifData, xmpData, iptc, size] = result;
      size = size || {};
      iptc = iptc || {};
      return {
        CreateDate: normalizeDate(exifData.exif.CreateDate),
        ModifyDate: normalizeDate(exifData.image.ModifyDate),
        Width: size.width || exifData.image.ImageWidth || exifData.exif.ExifImageWidth,
        Height: size.height || exifData.image.ImageHeight || exifData.exif.ExifImageHeight,
        Tags: xmpData.keywords || iptc.keywords || [],
        Regions: regionInfoParser.parse(xmpData),
        // FileSize: buffer.length,
        CameraBrand: exifData.image.Make,
        CameraModel: exifData.image.Model,
        Orientation: exifData.image.Orientation,
        Flash: exifData.exif.Flash,
        UserRating: xmpData.rating,
        Thumbnail: extractExifThumbnail(exifData, exifBuffer),
        Mime: 'image/jpeg',
        Type: 'exifImage',
        Raw: Object.assign(exifData, xmpData, iptc, size)
      };
    }, ex => {
      throw new Error('Error while processing file: ' + sourceFile + ':' + ex);
    });
  } catch (ex) {
    throw ex;
  }
};

var processExifTool = function (fileName, args) {
  if (args === undefined) {
    args = ['-n'];
  }
  return new Promise((resolve, reject) => {
    /** exiftool: */
    exiftool.metadata(fileName, args, function (error, metadata) {
      if (error) {
        return reject(error);
      } else {
        if (Object.keys(metadata).length === 0) {
          return resolve({});
        }

        var createDate = metadata.createDate;
        if (createDate === undefined) {
          createDate = metadata['date/timeOriginal'];
        }
        if (createDate === undefined || createDate === '0000:00:00 00:00:00') {
          createDate = metadata['fileModificationDate/Time'];
        }
        var modifyDate = metadata.modifyDate;
        if (modifyDate === undefined || modifyDate === '0000:00:00 00:00:00') {
          modifyDate = createDate;
        }

        metadata.regionInfo = regionInfoParser.parse(metadata);

        resolve({
          CreateDate: normalizeDate(createDate),
          ModifyDate: normalizeDate(modifyDate),
          Width: metadata.imageWidth,
          Height: metadata.imageHeight,
          Tags: extractTags(metadata),
          Regions: metadata.regionInfo,
          FileSize: metadata.fileSize,
          CameraBrand: metadata.make,
          CameraModel: metadata.cameraModelName,
          Orientation: metadata.orientation,
          Flash: metadata.flash,
          UserRating: metadata.rating,
          Mime: metadata.mimeType,
          Type: 'exifTool',
          Raw: metadata
        });
      }
    });
  });
};

var processMp4Info = function (fileName) {
  return new Promise((resolve, reject) => {
    /** exiftool: */
    mp4Info.info(fileName, function (error, metadata) {
      if (error) {
        return reject(error);
      } else {
        if (Object.keys(metadata).length === 0) {
          return resolve({});
        }

        let videoTrack = (metadata.tracks || []).find(t => t.track_width > 0);

        resolve({
          CreateDate: normalizeDate(metadata.created),
          ModifyDate: normalizeDate(metadata.modified),
          Width: videoTrack.track_width,
          Height: videoTrack.track_height,
          Tags: metadata.brands,
          Regions: undefined,
          FileSize: metadata.fileSize,
          CameraBrand: undefined,
          CameraModel: undefined,
          Orientation: undefined,
          Flash: undefined,
          UserRating: undefined,
          Mime: 'video/mp4',
          Type: 'mp4',
          Raw: metadata
        });
      }
    });
  });
};

// This should be the suggested date, more insecure than the exif info
var fileSystemFallback = function (fileName) {
  return new Promise((resolve, reject) => {
    fs.stat(fileName, function (error, stats) {
      if (error) {
        return reject(error);
      } else {
        resolve({
          CreateDate: stats.ctime,
          ModifyDate: stats.mtime,
          Tags: [],
          Mime: 'file',
          Type: 'system',
          Raw: stats
        });
      }
    });
  });
};

var saveTagsToFile = function (tags, sourceFile) {
  var newTagStr = tags.length > 0 ? tags.join(tagsDelimiter) : '';
  return processExifTool(sourceFile, ['-' + tagHolderItpc + '=' + newTagStr, '-overwrite_original']);
};

var prepareExifToolArgs = function (obj, operator) {
  operator = operator || '=';
  return Object.entries(obj).map(ent => '-' + ent[0] + operator + ent[1]);
};

var extractTags = function (metadata) {
  var tags = [];

  var tagString = metadata[tagHolderItpc];
  if (tagString !== undefined) {
    if (Array.isArray(tagString)) {
      tagString = tagString[0];
    }
    tags = tagString.split(tagsDelimiter);
  }
  return tags;
};

module.exports = {
  readMediaInfo: function (filePath, useFallback) {
    if (hasExifInfo(filePath)) {
      let fallback = () => { return Promise.reject(new Error('Failed to parse file: ' + filePath)); };
      if (useFallback) {
        fallback = () => { return processExifTool(filePath); };
      }
      if (isImage(filePath)) {
        // Exif image is much faster but only supports jpeg
        return processExifImage(filePath).catch(ex => {
          return fallback();
        });
      } else if (isMp4Video(filePath)) {
        // File info from mp4 box
        return processMp4Info(filePath).catch(ex => {
          return fallback();
        });
      }
    }
    if (useFallback) {
      return fileSystemFallback(filePath);
    }
    var extension = path.extname(filePath);
    return Promise.reject(new Error('File type not recognized: ' + extension));
  },

  // CRUD Tags
  addTag: function (sourceFile, newTag) {
    return this.getTags(sourceFile).then(
      function (tags) {
        var tagCountStart = tags.length;
        if (Array.isArray(newTag)) {
          newTag.forEach(function (tag) {
            if (tags.indexOf(tag) < 0) {
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
  removeTag: function (sourceFile, newTag) {
    return this.getTags(sourceFile).then(
      function (tags) {
        if (tags.indexOf(newTag) >= 0) {
          tags = tags.filter(
            tag => tag.valueOf() !== '' && tag.valueOf() !== newTag.valueOf()
          );
          return saveTagsToFile(tags, sourceFile);
        }
      });
  },
  getTags: function (sourceFile) {
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
  } */
  addRegion: function (sourceFile, newRegion) {
    if (newRegion === undefined || newRegion.area === undefined) {
      return Promise.reject(new Error('New regions must be valid'));
    }
    let newRegionsExif = regionInfoParser.prepareArea(newRegion);
    let args = prepareExifToolArgs(newRegionsExif, '+=');
    return this.readMediaInfo(sourceFile).then(info => {
      if (Object.keys(info.Regions).length === 0) {
        let newRegionInfo = regionInfoParser.prepareDimensions(info.Width, info.Height);
        args = args.concat(prepareExifToolArgs(newRegionInfo));
      }
      return processExifTool(sourceFile, args);
    });
  },
  /** Get the thumbnail as an base64 encoded image from an extracted meta data object */
  getEncodedThumbnail: function (mediaInfo) {
    if (mediaInfo && mediaInfo.Thumbnail) {
      return mediaInfo.Thumbnail.base64();
    }
    return undefined;
  },

  /** Internal methods used for testing **/
  _processExifImage: processExifImage,
  _processExifTool: processExifTool,
  _processFileSystem: fileSystemFallback
};
