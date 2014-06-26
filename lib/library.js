// --- Dependencies ---

var join = require('path').join;

var debug = require('debug')('zotero:library');

var Client = require('./client');
var proxy = require('./proxy');
var items = require('./items');
var collections = require('./collections');

var utils = require('./utils');
var extend = utils.extend;
var omit = utils.omit;

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
 * @param {Function} [callback]
 */
Library.prototype.get = function (target, options, callback) {
  debug('#get "%s", %j', target, options);

  if (arguments.length === 2 && typeof options === 'function') {
    callback = options; options = null;
  }

  options = extend({}, this.options, options);

  var path = this.path(target);
  var headers = extend({}, this.headers);

  // Add API key as parameter or header if present,
  // but permit overrides!
  if (this.key && !options.key && !headers.Authentication) {
    if (this.client.version > 2) {
      headers.Authentication = ['Bearer', this.key].join(' ');
    } else {
      options.key = this.key;
    }
  }

  return this.client.get(path, options, headers, callback);
};

// --- Exports ---
exports = module.exports = Library;
