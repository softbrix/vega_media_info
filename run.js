var mediaInfo = require('./index.js');
var fs = require('fs');

if (process.argv.length < 3) {
  console.log('Must give source file parameter');
  console.log('Usage: node run.js <source_file>');
  process.exit(1);
}

var sourceFile = process.argv[2];

try {
  mediaInfo.readMediaInfo(sourceFile, false).then((info) => {
    if (info && info.Thumbnail) {
      fs.writeFileSync('thumbnail.jpg', info.Thumbnail.buffer);
    }
    return info;
  }).then(console.log);
} catch (ex) {
  console.error(ex);
}
