var proxy = require('./proxy');

/** @module zotero */

/**
 * Items proxy object used by Library. This proxy makes it easy
 * to construct API paths for accessing items.
 *
 * @class items
 * @static
 */
function items(library) {
  var instance = proxy(library, 'get', 'items');

  Object.defineProperties(instance, {

    library: {
      value: library
    },

    top: {
      value: proxy(instance, 'get', 'top')
    },

    trash: {
      value: proxy(instance, 'get', 'trash')
    },

    children: {
      value: proxy(instance, 'get', '', 'children')
    },

    tags: {
      value: proxy(instance, 'get', '', 'tags')
    }

  });

  return instance;
}

// --- Exports ---
exports = module.exports = items;
