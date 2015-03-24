var config = require('config');
var convert = require('convert');
var parse = require('color-parser');

function isBikeshareStation(place) {
  return place.place_id.lastIndexOf('bicycle_rent_station') !== -1;
}

exports.places = {
  fill: function(display, data) {
    var place = data.owner;
    if(isBikeshareStation(place)) {
      return '#f00';
    }
    else {
      return 'none';
    }
  },

  stroke: function(display, data) {
    var place = data.owner;
    if(isBikeshareStation(place)) {
      return '#fff';
    }
  },

  'stroke-width': function(display, data) {
    var place = data.owner;
    if(isBikeshareStation(place)) {
      return '2px';
    }
  },

  r: function(display, data) {
    var place = data.owner;
    if(isBikeshareStation(place)) {
      return '6px';
    }
  }

};

exports.segment_labels = {
  'font-weight': 'bold'
};

exports.segments = {
  // override the default stroke color
  stroke: function(display, segment) {
    if (!segment.focused) return;

    switch (segment.type) {
      case 'CAR':
        return '#888';
      case 'WALK':
        return '#0BC8F4';
      case 'BICYCLE':
        return '#ef3026';
      case 'TRANSIT':
        var route = segment.patterns[0].route;
        if (route.route_id) {
          var id = route.route_id.split(':');
          var agency = id[0].toLowerCase();
          var line = id[1].toLowerCase();
          return convert.routeToColor(segment.type, agency, line, route.route_color);
        }
    }
  },

  // override the default stroke width
  'stroke-width': function(display, segment, index, utils) {
    switch (segment.type) {
      case 'CAR':
      case 'BICYCLE':
        return '3px';
      case 'WALK':
        return '5px';
      case 'TRANSIT':
        // bus segments:
        if (segment.mode === 3) return utils.pixels(display.zoom.scale(), 2, 4, 6) + 'px';
        // all others:
        return utils.pixels(display.zoom.scale(), 5, 7, 9) + 'px';
    }
  },

  // specify the dash-array
  'stroke-dasharray': function(display, segment) {
    switch (segment.type) {
      case 'BICYCLE':
      case 'CAR':
        return '9,7';
      case 'WALK':
        return '0.1,9';
    }
  },

  // specify the line cap type
  'stroke-linecap': function(display, segment) {
    switch (segment.type) {
      case 'CAR':
        return 'butt';
      case 'WALK':
        return 'round';
      case 'BICYCLE':
        return 'butt';
    }
  },
  envelope: function(display, segment, index, utils) {
    switch (segment.type) {
      case 'TRANSIT':
        if (segment.mode === 3) return utils.pixels(display.zoom.scale(), 2, 4, 6) + 'px';
        // all others:
        return utils.pixels(display.zoom.scale(), 5, 7, 9) + 'px';
    }
  }
};

/** style overrides for segment-based labels **/

exports.segment_label_containers = {
  // specify the fill color for the label bubble
  fill: function(display, label) {
    if (!label.isFocused()) return;
    return '#008';
  }
};

exports.segments_halo = {
  'stroke-width': function(display, data, index, utils) {
    return data.computeLineWidth(display) + 6;
  }
};

// start/end icons and eventually points of interest//

exports.places_icon = {
  x: -15,
  y: -15,
  width: 30,
  height: 30,
  'xlink:href': function(display, data) {
    if (data.owner.getId() === 'from') return config.static_url() + '/images/graphics/start.svg';
    if (data.owner.getId() === 'to') return config.static_url() + '/images/graphics/end.svg';
  },
  cursor: 'pointer',
  stroke: 0,
  visibility: 'visible'
};

exports.multipoints_merged = exports.stops_merged = {
  r: function(display, data, index, utils) {
    return utils.pixels(display.zoom.scale(), 4, 6, 8);
  }
};
