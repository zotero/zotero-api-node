var debug = require('debug')('zotero:proxy'),
  join = require('path').join,
  slice = Array.prototype.slice;

/** @module zotero */

/**
 * Simple path proxy to allow a natural way of composing
 * API paths. When called, the proxy function will forward
 * the call and all arguments to the target, but will pre-
 * and postfix the first argument (if it is a string) with
 * the values passed to the generator function.
 *
 * @example
 *   var p = proxy(obj, 'm', 'foo', 'bar');
 *
 *   p('baz');
 *   //-> obj.m('foo/baz/bar')
 *
 * @class proxy
 * @static
 */
function $proxy(ctx, target, prefix, postfix) {
  prefix = prefix || '';
  postfix = postfix || '';

  var name = join(prefix, postfix);

  function proxy() {
    debug('%s called with: %j', name, arguments);

    var args = slice.apply(arguments);

    if (isId(args[0])) {
      args[0] = join(prefix, args[0].toString(), postfix);

    } else {
      args.unshift(join(prefix, postfix));
    }

    debug('%s forward with: %j', name, args);

    var fn = (typeof target === 'function') ? target : ctx[target];

    return fn.apply(ctx, args);
  }

  if (typeof target === 'string') {
    proxy[target] = proxy;
  }

  return proxy;
}


function isId(x) {
  var t = typeof x;
  return t === 'string' || t === 'number';
}

exports = module.exports = $proxy;
