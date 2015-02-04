'use strict';

// --- Dependencies ---
var debug = require('debug');

debug.enable('zotero:node');
var prints = debug('zotero:node');

var Client  = require('./client');
var Library = require('./library');
var Message = require('./message');
var Stream  = require('./stream');


/**
 * A Zotero API client package for Node.js. This package tries to make it
 * as easy as possible to bootstrap a Zotero client application in Node.js;
 * it comes with hardly any runtime dependencies and provides three simple
 * abstractions to interact with Zotero: `Client`, `Library`, and `Message`.
 *
 * Clients handle the HTTPS connection to a Zotero data server, observing
 * any rate-limiting directives issued by the server; you can configure
 * settings (like API versions, default headers etc.) for each Client.
 * Each Library represents a Zotero user or group library and is associated
 * with a Client instance; a Library offers many convenience methods to
 * make it easy to construct Zotero API requests. Each request and the
 * corresponding response are then encapsulated in a Message instance, wich
 * provides accessors and an extendable body parser collection to handle
 * the various formats supported by Zotero.
 *
 * @example
 *     var zotero = require('zotero');
 *
 *     // Create a new library using the default client
 *     var lib = zotero({ user: 'YOUR-USER-ID', key: 'YOUR-API-KEY' });
 *
 *     // Print the top 5 items of your library
 *     lib.items.top({ limit: 5 }, zotero.print);
 *
 * @module zotero
 * @main zotero
 */
function zotero(options) {
  return new Library(options);
}


/**
 * Prints information about an API response. You can
 * pass this as a callback to all API request methods,
 * if you just want to print the response.
 *
 * @example
 *     var lib = zotero({ user: 'USER_ID' });
 *     lib.items({ format: 'versions' }, zotero.print);
 *
 * @method
 * @static
 *
 * @param {Error} [error] The error (if any).
 * @param {Message} [message] The API response message.
 */
zotero.print = function (error, message) {
  if (error) {
    prints('API call failed: (%s) %s', error.code || 'no code', error.message);
  }

  if (message) {
    prints('Path:\t%s', message.path);
    prints('Status:\t%d', message.code);
    prints('Type:\t%s', message.type);
    prints('Headers:\t%j', message.headers);
    prints('Content:\t\%j', message.data);
  }
};

/**
 * Promisifies the Zotero client API using the passed-in
 * promisify method.
 *
 * To undo promisification, simply call `zotero.promisify.restore()`.
 *
 * @example
 *      // For Bluebird:
 *      zotero.promisify(Promise.promisify.bind(Promise));
 *
 *      // For Q:
 *      zotero.promisify(Q.denodeify.bind(Q));
 *
 * @method promisify
 * @static
 *
 * @param {Function} promisify The promisfy implementation.
 * @return {Boolean} Whether or not the promisfy method was called.
 */
zotero.promisify = function (promisify) {
  if (zotero.promisify.original) return false;

  zotero.promisify.original = Client.prototype.request;
  Client.prototype.request = promisify(Client.prototype.request);

  return true;
};

zotero.promisify.restore = function () {
  if (!zotero.promisify.original) return false;

  Client.prototype.request = zotero.promisify.original;
  delete zotero.promisify.original;

  return true;
};


// --- Exports ---
zotero.defaults = Client.defaults;

zotero.Client  = Client;
zotero.Library = Library;
zotero.Message = Message;
zotero.Stream  = Stream;

exports = module.exports = zotero;
