var traversable = require('./traversable');
var proxy = require('./proxy');
var extend = require('./utils').extend;


/** @module zotero */

/**
 * @class items
 * @static
 * @extends traversable
 */
function items(library) {
  var instance = proxy(library, 'get', 'items');

  extend(instance, traversable);

  Object.defineProperties(instance, {

    library: {
      value: library
    },

    top: { value: proxy(instance, 'get', 'top') },

    trash: { value: proxy(instance, 'get', 'trash') }

  });

  return instance;
}

// --- Exports ---
exports = module.exports = items;
