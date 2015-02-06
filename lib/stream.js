'use strict';

// --- Dependencies ---
var assert   = require('assert');
var debug    = require('debug')('zotero:stream');
var inherits = require('util').inherits;
var url      = require('url');

var EventEmitter = require('events').EventEmitter;
var EventSource  = require('eventsource');

var Client = require('./client');

/** @module zotero */

/**
 * Connects to the Zotero Streaming API.
 *
 * @class Stream
 * @constructor
 * @extends EventEmitter
 *
 * @param {Object} options
 */
function Stream(options) {
  Client.call(this, options);

  debug('connecting to %s...', this.url);

  var es = new EventSource(this.url, this.options);

  forward(es, this);

  /**
   * The wrapped EventSource instance.
   *
   * @property eventsource
   * @type EventSource
   */
  reader(this, 'eventsource', es);

  this.once('connected', function (evt) {
    assert(evt.data);
    assert(!this.connection);

    debug('connected (%s)', evt.data.connectionId);

    /**
     * The stream's connection id. Read-only value
     * that will be set automatically when the
     * `connected` Event is received.
     *
     * @property connection
     * @type String
     */
    reader(this, 'connection', evt.data.connectionId);

  });

  this.on('error', function (_, evt) {
    debug('event source error: %j', evt);
  });
}

inherits(Stream, EventEmitter);

Stream.defaults = {
  host: 'stream.zotero.org',
  protocol: 'https',

  headers: Client.headers
};

reader(Stream.prototype, 'url', function () {
  return url.format(this.options);
});

reader(Stream.prototype, 'path', function () {
  return ['connections', this.connection].join('/');
});

Stream.prototype.close = function () {
  assert(this.eventsource);
  this.eventsource.close();

  return this;
};

Stream.prototype.subscribe = function (subscriptions, callback) {
  assert(this.connection, 'not connected');
  assert(subscriptions);

  if (!Array.isArray(subscriptions))
    subscriptions = [subscriptions];

  subscriptions = { subscriptions: subscriptions };

  return this.post(this.path, null, subscriptions, null, callback);
};

Stream.prototype.unsubscribe = function (key_or_topic, callback) {
  assert(this.connection, 'not connected');
  assert(key_or_topic);

  return this.post(this.path, null, key_or_topic, null, callback);
};

// --- Private Helpers ---

function forward(src, dst) {
  assert(src instanceof EventEmitter);
  assert(dst instanceof EventEmitter);

  dst.on('removeListener', function (type, listener) {
    assert(type);
    assert(typeof listener === 'function');

    src.removeListener(type, listener.proxy || listener);
  });

  dst.on('newListener', function (type, listener) {
    // Proxy must be unique per listener, so we assert
    // that the proxy has not been set yet!
    assert(typeof listener === 'function');
    assert(!listener.proxy);

    listener.proxy = function (evt) {
      listener.call(dst, {
        type: evt.type,
        data: evt.data && JSON.parse(evt.data)
      }, evt);
    };

    src.on(type, listener.proxy);
  });

}

function reader(ctx, name, value) {
  var prop = {};

  //prop.writable   = false;
  prop.enumerable = false;

  prop[(typeof value === 'function') ? 'get' : 'value'] = value;

  Object.defineProperty(ctx, name, prop);
}

// --- Module Exports ---
module.exports = Stream;
