
const assert = require('assert');
const regionInfo = require('../lib/regionInfo.js');

describe('Vega Media Info Region Info Module', function () {
  let regionExifStrings = {
    regionAppliedToDimensionsW: 1080,
    regionAppliedToDimensionsH: 720,
    regionAppliedToDimensionsUnit: 'pixel',
    regionName: 'First name, Second Name',
    regionType: 'Face, Face',
    regionAreaX: '0.778704, 0.197222',
    regionAreaY: '0.636806, 0.334722',
    regionAreaW: '0.440741, 0.253704',
    regionAreaH: '0.723611, 0.458333',
    regionAreaUnit: 'normalized, normalized'
  };
  let regionObject = {
    'appliedToDimensions': {
      'w': 1080,
      'h': 720,
      'unit': 'pixel'},
    'regionList': [
      {'type': 'Face',
        'name': 'First name',
        'area':
        {'x': 0.778704, 'y': 0.636806, 'w': 0.440741, 'h': 0.723611, 'unit': 'normalized'}
      },
      {'type': 'Face',
        'name': 'Second Name',
        'area':
        {'x': 0.197222, 'y': 0.334722, 'w': 0.253704, 'h': 0.458333, 'unit': 'normalized'}
      }
    ]};

  it('parse region info', function () {
    let parsed = regionInfo.parse(regionExifStrings);
    return assert.deepEqual(regionObject, parsed);
  });

  it('prepare region info', function () {
    return assert.deepEqual(regionExifStrings, regionInfo.prepare(regionObject));
  });
});
