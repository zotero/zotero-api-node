var debug = require('debug')('zotero:proxy'),
  join = require('path').join,
  slice = Array.prototype.slice;

/** @module zotero */

/**
 * @class proxy
 * @static
 */
function $proxy(ctx, target, name) {

  function proxy() {
    debug('%s called with: %j', name, arguments);

    var args = slice.apply(arguments);

    var prefix = arguments.callee.prefix || name;
    var postfix = arguments.callee.postfix || '';

    if (args.length && typeof args[0] === 'string') {
      args[0] = join(prefix, args[0], postfix);

    } else {
      args.unshift(join(prefix, postfix));
    }

    debug('%s forward with: %j', name, args);

    var fn = typeof target === 'function' ? target : ctx[target];

    return fn.apply(ctx, args);
  }

  proxy.prefix = name;

  proxy.get = proxy;

  return proxy;
}

exports = module.exports = $proxy;
