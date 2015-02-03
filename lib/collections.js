'use strict';

var proxy = require('./proxy');

/** @module zotero */

/**
 * Collections proxy object used by Library. This proxy makes it
 * easy to construct API paths for accessing collections.
 *
 * @class collections
 * @static
 */
function collections(library) {
  var instance = proxy(library, 'get', 'collections');

  Object.defineProperties(instance, {

    library: {
      value: library
    },

    top: {
      value: proxy(instance, 'get', 'top')
    },

    collections: {
      value: proxy(instance, 'get', '', 'collections')
    },

    nested: {
      get: function () { return this.collections; }
    },

    items: {
      value: proxy(instance, 'get', '', 'items')
    },

    tags: {
      value: proxy(instance, 'get', '', 'tags')
    }
  });

  Object.defineProperty(instance.items, 'top', {
    value: proxy(instance, 'get', '', 'items/top')
  });

  return instance;
}

// --- Exports ---
exports = module.exports = collections;
