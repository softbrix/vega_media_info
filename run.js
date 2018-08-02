var mediaInfo = require('./index.js');
var fs = require('fs');

if (process.argv.length < 3) {
  console.log('Must give source and destination dirs as parameters');
  process.exit(1);
}

var sourceFile = process.argv[2];

try {
  mediaInfo._processExifTool(sourceFile).then((info) => {
    if (info.Thumbnail) {
      fs.writeFileSync('thumbnail.jpg', info.Thumbnail.buffer);
    }
    return info;
  }).then(console.log);
} catch (ex) {
  console.error(ex);
}
