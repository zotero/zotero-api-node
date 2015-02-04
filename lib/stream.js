'use strict';

// --- Dependencies ---
var assert   = require('assert');
var debug    = require('debug')('zotero:stream');
var inherits = require('util').inherits;

var EventEmitter = require('events').EventEmitter;
var EventSource  = require('eventsource');

var pkg = require('../package.json');

var utils  = require('./utils');
var extend = utils.extend;

/** @module zotero */

/**
 * Connects to the Zotero Streaming API.
 *
 * @class Stream
 * @constructor
 * @extend EventEmitter
 *
 * @param {Object} options
 */
function Stream(options) {
  EventEmitter.call(this);

  this.options = extend({}, Stream.defaults, options);

  if (options && options.headers)
    this.options.headers = extend({}, Stream.defaults.headers, options.headers);

  debug('creating new event source for %s', this.options.url);

  var es = new EventSource(this.options.url, this.options);

  forward(es, this);

  /**
   * The wrapped EventSource instance.
   *
   * @property eventsource
   * @type EventSource
   */
  reader(this, 'eventsource', es);

  this.once('connected', function (evt) {
    if (evt.connectionId) {

      /**
       * The stream's connection id.
       *
       * @property connection
       * @type String
       */
      reader(this, 'connection', evt.connectionId);
    }
  }.bind(this));
}

inherits(Stream, EventEmitter);

Stream.defaults = {
  url: 'https://stream.zotero.org',

  headers: {
    'Zotero-API-Version': '3',
    'User-Agent': ['zotero-node', pkg.version].join('/')
  }
};

Stream.prototype.close = function () {
  assert(this.eventsource);
  this.eventsource.close();

  return this;
};

//Stream.prototype.subscribe = function (subscriptions) {
//};
//
//Stream.prototype.unsubscribe = function (subscriptions) {
//};

// --- Private Helpers ---

function forward(src, dst) {
  assert(typeof src.emit === 'function');
  assert(typeof dst.emit === 'function');

  var original = src.emit;

  src.emit = function () {
    original.apply(src, arguments);
    dst.emit.apply(dst, arguments);
  };
}

function reader(ctx, name, value) {
  Object.defineProperty(ctx, name, {
    writeable: false,
    enumerable: false,
    value: value
  });
}

// --- Module Exports ---
module.exports = Stream;
