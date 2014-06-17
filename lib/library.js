// --- Dependencies ---

var join = require('path').join;

var debug = require('debug')('zotero:library');

var Client = require('./client');

var utils = require('./utils');
var extend = utils.extend;
var omit = utils.omit;

/** @module zotero/library */

function Library(options) {
  options = options || {};

  this.client = options.client || new Client();

  if (options.group) this.group = options.group;
  if (options.user)  this.user  = options.user;

  this.options = omit(options, 'client', 'user', 'group');
}

Object.defineProperties(Library.prototype, {

  /** @property {'user'|'group'|undefined} type - the library type. */
  type: {
    get: function () {
      if (this.user  != null) return 'user';
      if (this.group != null) return 'group';

      return undefined;
    }
  },

  /** @property {number} id - the library id. */
  id: {
    get: function () { return this.user || this.group; }
  },

  /** @property {string} prefix - the library path prefix. */
  prefix: {
    get: function () {
      return this.id ? join(this.type + 's', this.id.toString()) : '';
    }
  }
});


Library.prototype.get = function (path, options, callback) {
  debug('#get "%s", %j', path, options);

  if (arguments.length === 2 && typeof options === 'function') {
    callback = options; options = null;
  }

  options = extend({}, this.options, options);
  path = join(this.prefix, path);

  return this.client.get(path, options, callback);
};

// --- Exports ---
exports = module.exports = Library;
