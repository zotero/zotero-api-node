'use strict';

// --- Dependencies ---
var assert   = require('assert');
var debug    = require('debug')('zotero:stream');
var inherits = require('util').inherits;
var url      = require('url');
var WS       = require('ws');

var Client = require('./client');
var pick   = require('./utils').pick;


/** @module zotero */


var SUBSCRIBE    = 'createSubscriptions';
var UNSUBSCRIBE  = 'deleteSubscriptions';
var SUBSCRIBED   = 'subscriptionsAdded';
var UNSUBSCRIBED = 'subscriptionsDeleted';
var CONNECTED    = 'connected';

/**
 * Connects to the Zotero Streaming API.
 *
 * @class Stream
 * @constructor
 * @extends Client
 *
 * @param {Object} options
 */
function Stream(options) {
  var singleton = options && options.key;

  if (singleton) {
    options.headers = options.headers || {};
    options.headers['Zotero-API-Key'] = options.key;

    delete options.key;
  }

  Client.call(this, options);

  debug('connecting to %s...', this.url);

  /**
   * The WebSocket to the Zotero API server.
   *
   * @property ws
   * @type WebSocket
   */
  this.ws = new WS(this.url, this.options)

    .on('open', function () {
      debug('websocket connection established');
      this.emit('open');

    }.bind(this))

    .on('message', this.receive.bind(this))

    .on('close', function () {
      debug('websocket connection closed');
      this.emit('close');

    }.bind(this))

    .on('error', function (error) {
      debug('websocket error: %j', error);
      this.emit('error', error);

    }.bind(this));
}

inherits(Stream, Client);

Stream.defaults = {
  hostname: 'stream.zotero.org',
  protocol: 'https',

  headers: Client.headers
};

reader(Stream.prototype, 'url', function () {
  return url.format(this.options);
});

Stream.prototype.close = function () {
  assert(this.ws);
  this.ws.close();

  return this;
};

Stream.prototype.receive = function (message, flags) {
  var data;

  try {
    if (flags.binary)
      throw new Error('binary stream not supported');

    if (flags.masked)
      throw new Error('masked stream not supported');

    data = JSON.parse(message);

    if (!data.event)
      throw new Error('received message without event');

    debug('event "%s" message received', data.event);

    switch (data.event) {

    case CONNECTED:
      this.emit(data.event, data);
      break;

    case SUBSCRIBED:
      this.emit(data.event, data.subscriptions, data.errors);
      break;

    case UNSUBSCRIBED:
      this.emit(data.event);
      break;

    default:
      this.emit(data.event, pick(data, 'topic', 'apiKey', 'version'));
    }


  } catch (error) {
    this.emit('error', error);
    return this;
  }

  this.emit('message', data);

  return this;
};

Stream.prototype.send = function (data, callback) {
  assert(this.ws);

  this.ws.send(data, function (error) {
    if (error) this.emit('error', error);

    if (typeof callback === 'function')
      callback(error);
  });

  return this;
};

Stream.prototype.subscribe = function (subscriptions, callback) {
  assert(subscriptions);

  if (!Array.isArray(subscriptions))
    subscriptions = [subscriptions];

  return this.send({
    action: SUBSCRIBE,
    subscriptions: subscriptions

  }, callback);
};

Stream.prototype.unsubscribe = function (subscriptions, callback) {
  assert(subscriptions);

  if (!Array.isArray(subscriptions))
    subscriptions = [subscriptions];

  return this.send({
    action: UNSUBSCRIBE,
    subscriptions: subscriptions

  }, callback);
};

// --- Private Helpers ---

function reader(ctx, name, value) {
  var prop = {};

  //prop.writable   = false;
  prop.enumerable = false;

  prop[(typeof value === 'function') ? 'get' : 'value'] = value;

  Object.defineProperty(ctx, name, prop);
}

// --- Module Exports ---
module.exports = Stream;
