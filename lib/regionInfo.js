
function flattenRegions (regionList) {
  let regions = {
    types: [],
    names: [],
    x: [],
    y: [],
    w: [],
    h: [],
    units: []
  };
  regionList.forEach(region => {
    regions.types.push(region.type);
    regions.names.push(region.name);
    regions.x.push(region.area.x);
    regions.y.push(region.area.y);
    regions.w.push(region.area.w);
    regions.h.push(region.area.h);
    regions.units.push(region.area.unit);
  });
  return regions;
}

function parseField (field) {
  if (field === undefined) {
    return [];
  }
  // Join the array and split again because some fields might be corrupt and
  // already contain multiple fields
  if (Array.isArray(field)) {
    field = field.join(',');
  }
  if (typeof field === 'string' && field.indexOf(',') >= 0) {
    return field.split(',').map(f => f.trim());
  } else {
    return [field];
  }
}

module.exports = {
  parse: function (metadata) {
    var info = {};

    info.appliedToDimensions = {
      w: parseInt(metadata.regionAppliedToDimensionsW || metadata.imageWidth),
      h: parseInt(metadata.regionAppliedToDimensionsH || metadata.imageHeight),
      unit: metadata.regionAppliedToDimensionsUnit || 'pixel'
    };

    if (metadata.regionType !== undefined) {
      var // Region Area
        x = parseField(metadata.regionAreaX);

      var y = parseField(metadata.regionAreaY);

      var w = parseField(metadata.regionAreaW);

      var h = parseField(metadata.regionAreaH);

      var unit = parseField(metadata.regionAreaUnit);

      // Region

      var types = parseField(metadata.regionType);
      var names = parseField(metadata.regionName);

      info.regionList = types.map((type, idx) => {
        return {
          type: type,
          name: names[idx],
          area: {
            x: parseFloat(x[idx]),
            y: parseFloat(y[idx]),
            w: parseFloat(w[idx]),
            h: parseFloat(h[idx]),
            unit: unit[idx]
          }
        };
      });
    } else {
      return {};
    }

    return info;
  },
  prepare: function (info) {
    let regions = flattenRegions(info.regionList);

    var metadata = {
      regionAppliedToDimensionsW: info.appliedToDimensions.w,
      regionAppliedToDimensionsH: info.appliedToDimensions.h,
      regionAppliedToDimensionsUnit: info.appliedToDimensions.unit,
      regionType: regions.types.join(', '),
      regionName: regions.names.join(', '),
      regionAreaX: regions.x.join(', '),
      regionAreaY: regions.y.join(', '),
      regionAreaW: regions.w.join(', '),
      regionAreaH: regions.h.join(', '),
      regionAreaUnit: regions.units.join(', ')
    };

    return metadata;
  },
  prepareDimensions: function (width, height, unit) {
    return {
      regionAppliedToDimensionsW: width,
      regionAppliedToDimensionsH: height,
      regionAppliedToDimensionsUnit: unit || 'pixel'
    };
  },
  prepareArea: function (region) {
    return {
      regionType: region.type,
      regionName: region.name,
      regionAreaX: region.area.x,
      regionAreaY: region.area.y,
      regionAreaW: region.area.w,
      regionAreaH: region.area.h,
      regionAreaUnit: region.area.unit
    };
  }
};
