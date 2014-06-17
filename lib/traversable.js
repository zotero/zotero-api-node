var join = require('path').join;

/** @module zotero */

/**
 * Traversable mixin.
 *
 * @class traversable
 * @static
 */
var traversable = {

  /**
   * @method path
   * @param {String} [target]
   * @return {String} the full path to the target.
   */
  path: function (target) {
    return join(this.prefix || '', target || '');
  }
};

// --- Exports ---
exports = module.exports = traversable;
