// --- Dependencies ---

var join = require('path').join;

var debug = require('debug')('zotero:library');

var Client = require('./client');
var proxy = require('./proxy');
var items = require('./items');

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

  // Set custom HTTP headers
  extend(this.client.options.headers, options.headers);

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
   * All options will be sent as parameters with every API call
   * issued by the library.
   *
   * @property options
   * @type Object
   */
  this.options = omit(options, 'client', 'user', 'group', 'headers');


  Object.defineProperties(this, {

    items: {
      value: items(this)
    },

    collections: {
      value: proxy(this, 'get', 'collections')
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
  return join(this.prefix, target || '');
};

/**
 * @method get
 */
Library.prototype.get = function (target, options, callback) {
  debug('#get "%s", %j', target, options);

  if (arguments.length === 2 && typeof options === 'function') {
    callback = options; options = null;
  }

  options = extend({}, this.options, options);
  var path = this.path(target);

  return this.client.get(path, options, callback);
};

// --- Exports ---
exports = module.exports = Library;
