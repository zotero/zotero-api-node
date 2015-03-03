'use strict';

// --- Dependencies ---
var assert   = require('assert');
var debug    = require('debug')('zotero:stream');
var util     = require('util');
var url      = require('url');
var WS       = require('ws');

var inherits = util.inherits;
var format   = util.format;

var Client = require('./client');
var pick   = require('./utils').pick;


/** @module zotero */


// Zotero API Vocabulary

var SUBSCRIBE    = 'createSubscriptions';
var UNSUBSCRIBE  = 'deleteSubscriptions';
var SUBSCRIBED   = 'subscriptionsAdded';
var UNSUBSCRIBED = 'subscriptionsDeleted';
var CONNECTED    = 'connected';


/**
 * Connects to the Zotero Streaming API
 * by establishing a WebSocket connection.
 *
 * @class Stream
 * @constructor
 * @extends Client
 *
 * @param {Object} options
 */
function Stream(options) {

  /**
   * Whether or not the Stream was initialized as
   * a single- or multi-key stream.
   *
   * @property multi
   * @type Boolean
   */
  reader(this, 'multi', !(options && options.key));

  if (!this.multi) {
    options.headers = options.headers || {};
    options.headers['Zotero-API-Key'] = options.key;

    delete options.key;
  }

  Client.call(this, options);

  this.open();
}

inherits(Stream, Client);

Stream.DEFAULT_RETRY = 1000;
Stream.MAX_RETRY     = 3;

Stream.defaults = {
  hostname: 'stream.zotero.org',
  protocol: 'https',

  headers: Client.headers
};

reader(Stream.prototype, 'url', function () {
  return url.format(this.options);
});


Stream.prototype.open = function () {
  assert(!this.socket);
  debug('opening websocket connection...');

  /**
   * The WebSocket to the Zotero API server.
   *
   * @property socket
   * @type WebSocket
   */
  this.socket = new WS(this.url, this.options)
    .on('open', this.emit.bind(this, 'open'))

    .on('close', this.closed.bind(this))

    .on('message', this.receive.bind(this))

    .on('error', this.error.bind(this));

  return this;
};

Stream.prototype.closed = function () {
  debug('websocket connection closed');

  // re-connect if closed by server

  delete this.socket;
  return this;
};

Stream.prototype.receive = function (message, flags) {
  debug('message received');

  try {
    validate(flags);

    var data = JSON.parse(message);
    var type = data.event;

    switch (type) {

    case undefined:
      throw new Error('invalid message received: no event defined');

    case CONNECTED:
      data = pick(data, 'topics', 'retry');

      if (data.retry)
        this.retry = Number(data.retry) || Stream.DEFAULT_RETRY;

      this.emit(type, data);
      break;

    case SUBSCRIBED:
      this.emit(type, data.subscriptions, data.errors);
      break;

    case UNSUBSCRIBED:
      this.emit(type);
      break;

    default:
      this.emit(type, pick(data, 'topic', 'apiKey', 'version'));

    }

  } catch (reason) {
    return this.error(reason);
  }

  return this;
};


Stream.prototype.send = function (data, callback) {
  assert(this.socket);
  assert(data && data.action);

  debug('sending %s message', data.action);

  this.socket.send(data, function (error) {
    if (typeof callback === 'function')
      callback(error);
    if (error)
      this.emit('error', error);
  });

  return this;
};


Stream.prototype.close = function () {
  assert(this.socket);
  debug('closing websocket connection...');

  this.socket.close();

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

Stream.prototype.error = function (error) {
  if (typeof error === 'string')
    error = new Error(format.apply(null, arguments));

  debug(error.message);
  this.emit('error', error);

  return this;
};

// --- Private Helpers ---

function validate(flags) {
  if (flags.binary)
    throw new Error('binary stream not supported');

  if (flags.masked)
    throw new Error('masked stream not supported');

  return true;
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
