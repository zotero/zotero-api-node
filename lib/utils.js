var each = Array.prototype.forEach;
var slice = Array.prototype.slice;
var concat = Array.prototype.concat;

exports.extend = function extend(obj) {
  each.call(slice.call(arguments, 1), function(source) {
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  });

  return obj;
};

/** @return {object} with all keys converted to lower case */
exports.downcase = function downcase(obj) {
  var h, hs = {};

  for (h in obj) {
    hs[h.toLowerCase()] = obj[h];
  }

  return hs;
};

exports.pick = function pick(obj) {
  var i, ii, key, result = {},
    keys = concat.apply([], slice.call(arguments, 1));

  for (i = 0, ii = keys.length; i < ii; ++i) {
    key = keys[i];
    if (key in obj) result[key] = obj[key];
  }

  return result;
};

exports.omit = function omit(obj) {
  var exclude = concat.apply([], slice.call(arguments, 1));

  return exports.pick(obj, Object.keys(obj).filter(function (key) {
    return exclude.indexOf(key) < 0
  }));
};


