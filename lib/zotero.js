// --- Dependencies ---

//var debug = require('debug')('zotero');

var Client = require('./client');
var Library = require('./library');

/**
 * A Zotero API client module for Node.js.
 *
 * @module zotero
 * @main
 */
function zotero(options) {
  return new Library(options);
}


// --- Exports ---

zotero.Client = Client;
zotero.Library = Library;

exports = module.exports = zotero;
