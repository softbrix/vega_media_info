// Source from: https://github.com/nodeca/probe-image-size

'use strict';

/* eslint-disable consistent-return */

module.exports = function (metaBlocks) {
  // 0xC0 (192) --> 0xCF (207)
  for (let code = 0xC0; code < 0xCF; ++code) {
    if (code === 0xC4 || code === 0xC8 || code === 0xCC) {
      continue;
    }
    if (metaBlocks['' + code]) {
      let data = metaBlocks[code];
      if (data.length <= 5) {
        continue;
      }
      let size = {
        width: data.readUInt16BE(7),
        height: data.readUInt16BE(5)
      };
      return size;
    }
  }
  return { err: 'Markers not found (3)' };
};
