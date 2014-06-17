var debug = require('debug')('zotero:proxy'),
  join = require('path').join,
  slice = Array.prototype.slice;


function $proxy(ctx, target, name) {

  function proxy() {
    debug('%s called with: %j', name, arguments);

    var args = slice.apply(arguments);
    var prefix = arguments.callee.prefix || name;

    if (args.length && typeof args[0] === 'string') {
      args[0] = join(prefix, args[0]);

    } else {
      args.unshift(prefix);
    }

    debug('%s forward with: %j', prefix, args);

    return target.apply(ctx, args);
  }

  proxy.prefix = name;

  return proxy;
}

exports = module.exports = $proxy;
