// --- Dependencies ---

var join = require('path').join;

var debug = require('debug')('zotero:library');

var Client = require('./client');

/** @module zotero/library */

function Library(options) {
  options = options || {};

  this.client = options.client || new Client();

  if (options.group) this.group = options.group;
  if (options.user)  this.user  = options.user;
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

  prefix: {
    get: function () {
      return this.id ? join(this.type + 's', this.id.toString()) : '';
    }
  }
});

// --- Exports ---
exports = module.exports = Library;
