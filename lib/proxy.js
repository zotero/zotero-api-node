var debug = require('debug')('zotero:proxy'),
  join = require('path').join,
  slice = Array.prototype.slice;


function extend(proxy, type, names) {
  var i, ii, name;

  if (names && names.length) {
    for (i = 0, ii = names.length; i < ii; ++i) {
      name = names[i];
      proxy[name] = function () {
        var args = slice.apply(arguments);

        switch (type) {
        case 'postfix':
          args[0] = join(args[0], name);
          break;

        default:
          args.unshift(name);
          break;
        }

        return proxy.apply(proxy, args);
      }
    }
  }

  return proxy;
}


function $proxy(ctx, target, prefix, extensions) {

  function proxy() {
    debug('%s called with: %j', prefix, arguments);

    var args = slice.apply(arguments);

    if (args.length && typeof args[0] === 'string') {
      args[0] = join(prefix, args[0]);

    } else {
      args.unshift(prefix);
    }

    debug('%s forward with: %j', prefix, args);

    return target.apply(ctx, args);
  }

  if (extensions) {
    for (var type in extensions) {
      extend(proxy, type, extensions[type]);
    }
  }

  return proxy;
}

exports = module.exports = $proxy;
