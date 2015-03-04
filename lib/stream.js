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

var utils  = require('./utils');
var find   = utils.find;
var pick   = utils.pick;

var array  = Array.isArray;

/** @module zotero */


// Zotero API Vocabulary

var SUBSCRIBE    = 'createSubscriptions';
var UNSUBSCRIBE  = 'deleteSubscriptions';
var SUBSCRIBED   = 'subscriptionsAdded';
var UNSUBSCRIBED = 'subscriptionsDeleted';
var CONNECTED    = 'connected';

var CLOSE_NORMAL = 1000;

function Subscriptions() {
  this.all = [];
}


Subscriptions.prototype.get = function (key) {
  return find(this.all, function (s) {
    return (s.apiKey === key);
  });
};

Subscriptions.prototype.merge = function () {
};

Subscriptions.prototype.add = function (subscriptions) {
  assert(array(subscriptions));

  for (var i = 0, ii = subscriptions.length; i < ii; ++i)
    this.merge(subscriptions[i]);

  return this;
};

//Subscriptions.prototype.remove = function (subscriptions) {
//};

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

  /**
   * @property retry
   * @type Object
   */
  reader(this, 'retry', {
    delay: Stream.DEFAULT_RETRY
  });

  /**
   * @property subscriptions
   * @type Array
   */
  this.subscriptions = [];

  this.open();
}

inherits(Stream, Client);

Stream.DEFAULT_RETRY = 10000;

Stream.defaults = {
  hostname: 'stream.zotero.org',
  protocol: 'https',

  headers: Client.headers
};

reader(Stream.prototype, 'url', function () {
  return url.format(this.options);
});


// --- Private Methods ---

/**
 * Opens the WebSocket.
 *
 * @method open
 * @private
 */
Stream.prototype.open = function () {
  assert(!this.socket);
  debug('opening websocket...');

  /**
   * The WebSocket to the Zotero API server.
   *
   * @property socket
   * @type WebSocket
   */
  this.socket = new WS(this.url, this.options)
    .on('open', this.opened.bind(this))

    .on('close', this.closed.bind(this))

    .on('message', this.receive.bind(this))

    .on('error', this.error.bind(this));

  return this;
};


/**
 * Called automatically when the WebSocket
 * connection has been established.
 *
 * @method opened
 * @private
 */
Stream.prototype.opened = function () {
  debug('websocket opened successfully');

  if (this.retry.timeout)
    clearTimeout(this.retry.timeout);

  if (this.subscriptions.length) {
    this.subscribe(this.subscriptions.slice());
  }

  this.subscriptions.length = 0;

  this.emit('open');

  return this;
};


/**
 * Called automatically when the WebSocket connection is
 * closed. If the socket was closed by the server and not
 * the client, tries to re-connect after the `retry`
 * interval has elapsed.
 *
 * @method closed
 * @private
 */
Stream.prototype.closed = function (code, message) {
  if (!this.socket) return this;

  assert(this.socket.readyState === WS.CLOSED);

  if (code === CLOSE_NORMAL) {
    debug('websocket closed');

  } else {
    debug('websocket closed unexpectedly, retry in %dms', this.retry.delay);

    if (this.retry.timeout)
      clearTimeout(this.retry.timeout);

    this.retry.timeout = setTimeout(this.open.bind(this), this.retry.delay);
  }

  this.emit('close', code, message);

  this.socket.removeAllListeners();
  delete this.socket;

  return this;
};


/**
 * Called when a message is received on the WebSocket.
 *
 * @method receive
 * @private
 */
Stream.prototype.receive = function (message, flags) {
  debug('message received');

  try {
    validate(flags);

    var data = JSON.parse(message);
    var type = data.event;

    switch (type) {

    case CONNECTED:
      data = pick(data, 'topics', 'retry');

      if (data.retry)
        this.retry.delay = Number(data.retry) || Stream.DEFAULT_RETRY;

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


/**
 * Sends a message over the WebSocket.
 *
 * @method send
 * @private
 */
Stream.prototype.send = function (data, callback) {
  assert(this.socket);
  assert(data && data.action);

  debug('sending %s message', data.action);

  this.socket.send(data, function (error) {
    if (typeof callback === 'function')
      callback(error);
    if (error)
      this.emit('error', error);
    else
      this.emit(data.action, data);
  });

  return this;
};


// --- Public Methods ---

/**
 * Closes the stream.
 *
 * @method close
 * @chainable
 */
Stream.prototype.close = function () {
  assert(this.socket);
  debug('closing websocket...');

  this.socket.close(CLOSE_NORMAL);

  return this;
};


/**
 * Subscribes to the given `subscriptions`.
 *
 * @method subscribe
 * @chainable
 *
 * @param {Object|Array} subscriptions
 * @param {Function} [callback] to be called when the subscribe
 *   request has been delivered.
 */
Stream.prototype.subscribe = function (subscriptions, callback) {
  assert(subscriptions);

  if (!array(subscriptions))
    subscriptions = [subscriptions];

  if (!this.socket || this.socket.readyState !== WS.OPEN) {
    while (subscriptions.length)
      this.subscriptions.push(subscriptions.pop());

    if (typeof callback === 'function')
      this.once(SUBSCRIBE, callback);

  } else {

    this.send({
      action: SUBSCRIBE,
      subscriptions: subscriptions

    }, callback);
  }

  return this;
};


/**
 * Unsubscribes from the given topic or API key subscriptions.
 *
 * @method unsubscribe
 * @chainable
 *
 * @param {Object|Array} subscriptions
 * @param {Function} [callback] to be called when the unsubscribe
 *   request has been delivered.
 */
Stream.prototype.unsubscribe = function (subscriptions, callback) {
  assert(subscriptions);

  if (!array(subscriptions))
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
Stream.Subscriptions = Subscriptions;
module.exports = Stream;
