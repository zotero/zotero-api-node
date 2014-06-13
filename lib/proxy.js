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

      proxy[name].name = name + '_proxy_extension';
    }
  }

  return proxy;
}


function $proxy(ctx, fn, prefix, extensions) {

  function proxy() {
    var args = slice.apply(arguments);

    if (args.length > 1 && typeof args[0] === 'string') {
      args[0] = join(prefix, args[0]);

    } else {
      args.unshift(prefix);
    }

    return fn.apply(ctx, args);
  }

  proxy.name = prefix + '_proxy';

  if (extensions) {
    for (var type in extensions) {
      extend(proxy, type, extensions[type]);
    }
  }

  return proxy;
}

exports = module.exports = $proxy;
