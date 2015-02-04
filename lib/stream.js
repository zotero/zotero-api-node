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
    if (!evt.data) return;

    /**
     * The stream's connection id.
     *
     * @property connection
     * @type String
     */
    reader(this, 'connection', evt.data.connectionId);

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
  assert(src instanceof EventEmitter);
  assert(dst instanceof EventEmitter);

  dst.on('removeListener', function (type, listener) {
    assert(type);

    if (typeof listener === 'function' && listener.proxy) {
      src.removeListener(type, listener.proxy);

    } else {
      src.removeListener.apply(src, arguments);
    }
  });

  dst.on('newListener', function (type, listener) {
    listener.proxy = function (evt) {
      listener.call(dst, {
        type: evt.type,
        data: evt.data && JSON.parse(evt.data)
      });
    };

    src.on(type, listener.proxy);
  });

}

function reader(ctx, name, value) {
  Object.defineProperty(ctx, name, {
    writable: false,
    enumerable: false,
    value: value
  });
}

// --- Module Exports ---
module.exports = Stream;
