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

