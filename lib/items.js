var proxy = require('./proxy');
var extend = require('./utils').extend;


/** @module zotero */

/**
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
    }

  });

  return instance;
}

// --- Exports ---
exports = module.exports = items;
