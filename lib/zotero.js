// --- Dependencies ---

var debug = require('debug');

debug.enable('zotero:node');
var print = debug('zotero:node');

var Client  = require('./client');
var Library = require('./library');
var Message = require('./message');


/**
 * A Zotero API client module for Node.js.
 *
 * @module zotero
 * @main
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
    print('API call failed: (%s) %s', error.code || 'no code', error.message);
  }

  if (message) {
    print('Path:\t%s', message.path);
    print('Status:\t%d', message.code);
    print('Type:\t%s', message.type);
    print('Headers:\t%j', message.headers);
    print('Content:\t\%j', message.data);
  }
};

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

zotero.Client = Client;
zotero.Library = Library;
zotero.Message = Message;

exports = module.exports = zotero;
