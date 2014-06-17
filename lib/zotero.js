// --- Dependencies ---

var debug = require('debug')('zotero');

var proxy = require('./proxy');
var Client = require('./client');

var utils = require('./utils');
var extend = utils.extend;

/**
 * A Zotero API client module for Node.js.
 *
 * @module zotero
 * @main
 */

function zotero(options) {
}


// --- Exports ---

zotero.Client = Client;

exports = module.exports = zotero;
