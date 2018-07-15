var mediaInfo = require('./index.js');

if (process.argv.length < 3) {
  console.log('Must give source and destination dirs as parameters');
  process.exit(1);
}

var sourceFile = process.argv[2];

mediaInfo.readMediaInfo(sourceFile).then(console.log);
