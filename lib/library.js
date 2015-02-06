'use strict';

// --- Dependencies ---

var assert = require('assert');
var join = require('path').join;

var debug = require('debug')('zotero:library');

var Client = require('./client');
var Stream = require('./stream');

var proxy = require('./proxy');
var items = require('./items');
var collections = require('./collections');

var utils  = require('./utils');
var extend = utils.extend;
var omit   = utils.omit;
var once   = utils.once;
var noop   = utils.noop;

/** @module zotero */

/**
 * Represents a Zotero library identified by a user or group Id.
 *
 * @class Library
 * @constructor
 *
 * @param {Object} options
 */
function Library(options) {
  options = options || {};

  /**
   * `Client` instance that handles the library's API access.
   *
   * @property client
   * @type Client
   */
  this.client = options.client || new Client();

  /**
   * The library's group id. Note that the `user` property
   * takes precedence over `group`; thus, if changing a user
   * library instance to a group library, the `user` id
   * must be deleted.
   *
   * @property group
   * @type Number
   */
  if (options.group) this.group = options.group;

  /**
   * The library's user id. A library should have either this
   * or a `group` id defined.
   *
   * @property user
   * @type Number
   */
  if (options.user) this.user = options.user;

  /**
   * The API key to use for this library. The key will be
   * added automatically to every request made for this
   * library.
   *
   * @property key
   * @type String
   */
  if (options.key) this.key = options.key;

  /**
   * All options will be sent as parameters with every API call
   * issued by the library.
   *
   * @property options
   * @type Object
   */
  this.options = omit(options, 'client', 'user', 'group', 'key', 'headers');


  Object.defineProperties(this, {

    /**
     * HTTP headers to be included in
     * every request for this library.
     *
     * @property headers
     * @type Object
     */
    headers: {
      enumerable: true,
      value: extend({}, options.headers)
    },

    /**
     * Items proxy. Calls the library's `get` method and injects
     * 'items' into the path argument. The proxy accepts exactly
     * the same arguments as `get`.
     *
     * @example
     *     lib.items();
     *     //-> calls lib.get('items');
     *
     *     lib.items(42);
     *     //-> calls lib.get('items/42');
     *
     *     lib.items.top();
     *     //-> calls lib.get('items/top');
     *
     *     lib.items.top({ format: 'versions' });
     *     //-> calls lib.get('items/top', { format: 'versions' });
     *
     * @method items
     */
    items: {
      value: items(this)
    },

    collections: {
      value: collections(this)
    },

    tags: {
      value: proxy(this, 'get', 'tags', '', true)
    },

    searches: {
      value: proxy(this, 'get', 'searches')
    },

    groups: {
      value: proxy(this, 'get', 'groups')
    },

    keys: {
      value: proxy(this, 'get', 'keys')
    }
  });
}

Object.defineProperties(Library.prototype, {

  /**
   * The library type (either *user* or *group*).
   *
   * @property type
   * @type 'user'|'group'|undefined
   */
  type: {
    get: function () {
      if (this.user  != null) return 'user';
      if (this.group != null) return 'group';

      return undefined;
    }
  },

  /**
   * The library's Zotero id. This property is read-only; to
   * change the id set the `user` or `group` property.
   *
   * @property id
   * @type Number
   */
  id: {
    get: function () { return this.user || this.group; }
  },

  /**
   * The library's API path prefix. Typically, this will be
   * `users/:id` or `groups/:id` depending on the library type.
   *
   * @property prefix
   * @type String
   */
  prefix: {
    get: function () {
      return this.id ? join(this.type + 's', this.id.toString()) : '';
    }
  }

});


/**
 * @method path
 * @param {String} [target]
 * @return {String} the full path to the target.
 */
Library.prototype.path = function (target) {
  return join('/', this.prefix, target || '');
};

/**
 * @method get
 *
 * @param {String} [target] The API target to call.
 * @param {Object} [options] API options to include in the call.
 * @param {Object} [headers] Additional HTTP headers.
 * @param {Function} [callback]
 *
 * @return {Message} The Zotero API message instance.
 */
Library.prototype.get = function (target, options, headers, callback) {

  if (arguments.length < 4) {
    if (typeof headers === 'function') {
      callback = headers; headers = null;

    } else if (typeof options === 'function') {
      callback = options; options = null;
    }
  }

  debug('#get "%s", %j, %j', target, options, headers);

  options = extend({}, this.options, options);

  var path = this.path(target);
  headers = extend({}, this.headers, headers);

  // Add API key as parameter or header if present,
  // but permit overrides!
  if (this.key && !options.key && !headers.Authorization) {
    if (this.client.version > 2) {
      headers.Authorization = ['Bearer', this.key].join(' ');
    } else {
      options.key = this.key;
    }
  }

  return this.client.get(path, options, headers, callback);
};

/**
 * Connects to the Zotero Stream API and listens for
 * Events for this library.
 *
 * @method stream
 *
 * @param {Function} [callback] Called with the Stream
 *   instance once the stream has been established.
 *
 * @return {Stream} A Stream instance for this library.
 */
Library.prototype.stream = function (callback) {
  assert(this.id);

  callback   = once(callback || noop);
  var stream = new Stream();

  debug('connection to library stream %s...', this.prefix);

  function failed(reason) {
    debug('failed to connect to library stream: %j', reason);
    callback(new Error('failed to connect to library stream'), stream);
  }

  return stream
    .once('connected', function () {
      try {
        stream.removeListener('error', failed);

        var subscription = {
          topics: ['/' + this.prefix]
        };

        if (this.key)
          subscription.apiKey = this.key;

        stream.subscribe(subscription, function (error, message) {
          if (error) return failed(error);

          if (message.code !== 201) {
            debug('status code 201 expected but was %s', message.code);
            return failed('failed to subscribe to library');
          }

          debug('successfully connected to library stream');
          callback(null, stream);
        });


      } catch (reason) {
        failed(reason);
      }

    }.bind(this))

    .on('error', failed);
};

// --- Exports ---
exports = module.exports = Library;
