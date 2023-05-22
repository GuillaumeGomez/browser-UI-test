// Comes from <https://www.npmjs.com/package/css-color-converter>.
// To be removed when <https://github.com/andyjansson/css-color-converter/pull/13>
// is merged.

/* eslint-disable */

"use strict";

const _colorName = require("./color-name.js");

const _cssUnitConverter = require("css-unit-converter");


function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var hex = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/;
var shortHex = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])?$/;
var rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0|1|0?\.\d+|\d+%))?\s*\)$/;
var rgbfn = /^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*(0|1|0?\.\d+|\d+%))?\s*\)$/;
var rgbperc = /^rgba?\(\s*(\d+%)\s*,\s*(\d+%)\s*,\s*(\d+%)(?:\s*,\s*(0|1|0?\.\d+|\d+%))?\s*\)$/;
var rgbpercfn = /^rgba?\(\s*(\d+%)\s+(\d+%)\s+(\d+%)(?:\s*\/\s*(0|1|0?\.\d+|\d+%))?\s*\)$/;
var hsl = /^hsla?\(\s*(0?\.\d+|\d+)(deg|rad|grad|turn)?\s*,\s*(\d+)%\s*,\s*(\d+)%(?:\s*,\s*(0?\.\d+|\d+%))?\s*\)$/;
var hslws = /^hsla?\(\s*(0?\.\d+|\d+)(deg|rad|grad|turn)?\s+(\d+)%\s+(\d+)%(?:\s*\/\s*(0?\.\d+|\d+%))?\s*\)$/;

function contains(haystack, needle) {
  return haystack.indexOf(needle) > -1;
}

function rgbToHsl(r, g, b) {
  var rprim = r / 255;
  var gprim = g / 255;
  var bprim = b / 255;
  var cmax = Math.max(rprim, gprim, bprim);
  var cmin = Math.min(rprim, gprim, bprim);
  var delta = cmax - cmin;
  var l = (cmax + cmin) / 2;

  if (delta === 0) {
    return [0, 0, l * 100];
  }

  var s = delta / (1 - Math.abs(2 * l - 1));

  var h = function () {
    switch (cmax) {
      case rprim:
        {
          return (gprim - bprim) / delta % 6;
        }

      case gprim:
        {
          return (bprim - rprim) / delta + 2;
        }

      default:
        {
          return (rprim - gprim) / delta + 4;
        }
    }
  }();

  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  var hprim = h / 60;
  var sprim = s / 100;
  var lprim = l / 100;
  var c = (1 - Math.abs(2 * lprim - 1)) * sprim;
  var x = c * (1 - Math.abs(hprim % 2 - 1));
  var m = lprim - c / 2;

  var _ref = function () {
    if (hprim < 1) return [c, x, 0];
    if (hprim < 2) return [x, c, 0];
    if (hprim < 3) return [0, c, x];
    if (hprim < 4) return [0, x, c];
    if (hprim < 5) return [x, 0, c];
    return [c, 0, x];
  }(),
      _ref2 = _slicedToArray(_ref, 3),
      rprim = _ref2[0],
      gprim = _ref2[1],
      bprim = _ref2[2];

  return [(rprim + m) * 255, (gprim + m) * 255, (bprim + m) * 255];
}

var Color = /*#__PURE__*/function () {
  function Color(_ref3) {
    var _ref4 = _slicedToArray(_ref3, 4),
        r = _ref4[0],
        g = _ref4[1],
        b = _ref4[2],
        a = _ref4[3];

    _classCallCheck(this, Color);

    this.values = [Math.max(Math.min(parseInt(r, 10), 255), 0), Math.max(Math.min(parseInt(g, 10), 255), 0), Math.max(Math.min(parseInt(b, 10), 255), 0), a == null ? 1 : Math.max(Math.min(parseFloat(a), 255), 0)];
  }

  _createClass(Color, [{
    key: "toRgbString",
    value: function toRgbString(forceAlpha = false) {
      var _this$values = _slicedToArray(this.values, 4),
          r = _this$values[0],
          g = _this$values[1],
          b = _this$values[2],
          a = _this$values[3];

      if (a === 1 && !forceAlpha) {
        return "rgb(".concat(r, ", ").concat(g, ", ").concat(b, ")");
      }

      return "rgba(".concat(r, ", ").concat(g, ", ").concat(b, ", ").concat(a, ")");
    }
  }, {
    key: "toHslString",
    value: function toHslString() {
      var _this$toHslaArray = this.toHslaArray(),
          _this$toHslaArray2 = _slicedToArray(_this$toHslaArray, 4),
          h = _this$toHslaArray2[0],
          s = _this$toHslaArray2[1],
          l = _this$toHslaArray2[2],
          a = _this$toHslaArray2[3];

      if (a === 1) {
        return "hsl(".concat(h, ", ").concat(s, "%, ").concat(l, "%)");
      }

      return "hsla(".concat(h, ", ").concat(s, "%, ").concat(l, "%, ").concat(a, ")");
    }
  }, {
    key: "toHexString",
    value: function toHexString() {
      var _this$values2 = _slicedToArray(this.values, 4),
          r = _this$values2[0],
          g = _this$values2[1],
          b = _this$values2[2],
          a = _this$values2[3];

      r = Number(r).toString(16).padStart(2, '0');
      g = Number(g).toString(16).padStart(2, '0');
      b = Number(b).toString(16).padStart(2, '0');
      a = a < 1 ? parseInt(a * 255, 10).toString(16).padStart(2, '0') : '';
      return "#".concat(r).concat(g).concat(b).concat(a);
    }
  }, {
    key: "toRgbaArray",
    value: function toRgbaArray() {
      return this.values;
    }
  }, {
    key: "toHslaArray",
    value: function toHslaArray() {
      var _this$values3 = _slicedToArray(this.values, 4),
          r = _this$values3[0],
          g = _this$values3[1],
          b = _this$values3[2],
          a = _this$values3[3];

      var _rgbToHsl = rgbToHsl(r, g, b),
          _rgbToHsl2 = _slicedToArray(_rgbToHsl, 3),
          h = _rgbToHsl2[0],
          s = _rgbToHsl2[1],
          l = _rgbToHsl2[2];

      return [h, s, l, a];
    }
  }]);

  return Color;
}();

function fromRgba(_ref5) {
  var _ref6 = _slicedToArray(_ref5, 4),
      r = _ref6[0],
      g = _ref6[1],
      b = _ref6[2],
      a = _ref6[3];

  return new Color([r, g, b, a]);
}

function fromRgb(_ref7) {
  var _ref8 = _slicedToArray(_ref7, 3),
      r = _ref8[0],
      g = _ref8[1],
      b = _ref8[2];

  return fromRgba([r, g, b, 1]);
}

function fromHsla(_ref9) {
  var _ref10 = _slicedToArray(_ref9, 4),
      h = _ref10[0],
      s = _ref10[1],
      l = _ref10[2],
      a = _ref10[3];

  var _hslToRgb = hslToRgb(h, s, l),
      _hslToRgb2 = _slicedToArray(_hslToRgb, 3),
      r = _hslToRgb2[0],
      g = _hslToRgb2[1],
      b = _hslToRgb2[2];

  return fromRgba([r, g, b, a]);
}

function fromHsl(_ref11) {
  var _ref12 = _slicedToArray(_ref11, 3),
      h = _ref12[0],
      s = _ref12[1],
      l = _ref12[2];

  return fromHsla([h, s, l, 1]);
}

function fromHexString(str) {
  var _ref13 = hex.exec(str) || shortHex.exec(str),
      _ref14 = _slicedToArray(_ref13, 5),
      r = _ref14[1],
      g = _ref14[2],
      b = _ref14[3],
      a = _ref14[4];

  r = parseInt(r.length < 2 ? r.repeat(2) : r, 16);
  g = parseInt(g.length < 2 ? g.repeat(2) : g, 16);
  b = parseInt(b.length < 2 ? b.repeat(2) : b, 16);
  a = a && (parseInt(a.length < 2 ? a.repeat(2) : a, 16) / 255).toPrecision(1) || 1;
  return fromRgba([r, g, b, a]);
}

function fromRgbString(str) {
  var _ref15 = rgb.exec(str) || rgbperc.exec(str) || rgbfn.exec(str) || rgbpercfn.exec(str),
      _ref16 = _slicedToArray(_ref15, 5),
      r = _ref16[1],
      g = _ref16[2],
      b = _ref16[3],
      a = _ref16[4];

  r = contains(r, '%') ? parseInt(r, 10) * 255 / 100 : parseInt(r, 10);
  g = contains(g, '%') ? parseInt(g, 10) * 255 / 100 : parseInt(g, 10);
  b = contains(b, '%') > 0 ? parseInt(b, 10) * 255 / 100 : parseInt(b, 10);
  a = a === undefined ? 1 : parseFloat(a) / (contains(a, '%') ? 100 : 1);
  return fromRgba([r, g, b, a]);
}

function fromHslString(reg, str) {
  var _reg$exec = reg.exec(str),
      _reg$exec2 = _slicedToArray(_reg$exec, 6),
      h = _reg$exec2[1],
      unit = _reg$exec2[2],
      s = _reg$exec2[3],
      l = _reg$exec2[4],
      a = _reg$exec2[5];

  unit = unit || 'deg';
  h = (0, _cssUnitConverter)(parseFloat(h), unit, 'deg');
  s = parseFloat(s);
  l = parseFloat(l);
  a = a === undefined ? 1 : parseFloat(a) / (contains(a, '%') ? 100 : 1);
  return fromHsla([h, s, l, a]);
}

function fromString(str) {
  const color = _colorName[str];
  if (color) {
    if (color.length === 4) {
      return fromRgba(color);
    }
    return fromRgb(color);
  }

  if (hex.test(str) || shortHex.test(str)) {
    return fromHexString(str);
  }

  if (rgb.test(str) || rgbperc.test(str) || rgbfn.test(str) || rgbpercfn.test(str)) {
    return fromRgbString(str);
  }

  if (hsl.test(str)) {
    return fromHslString(hsl, str);
  }

  if (hslws.test(str)) {
    return fromHslString(hslws, str);
  }

  return null;
}

module.exports = {
  fromString: fromString,
  fromRgb: fromRgb,
  fromRgba: fromRgba,
  fromHsl: fromHsl,
  fromHsla: fromHsla
};
