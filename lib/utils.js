var each = Array.prototype.forEach;
var slice = Array.prototype.slice;

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

