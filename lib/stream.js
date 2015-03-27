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
var index  = utils.findIndex;
var pick   = utils.pick;

var array  = Array.isArray;

/** @module zotero */


// --- Zotero API Vocabulary ---

var SUBSCRIBE    = 'createSubscriptions';
var UNSUBSCRIBE  = 'deleteSubscriptions';
var SUBSCRIBED   = 'subscriptionsCreated';
var UNSUBSCRIBED = 'subscriptionsDeleted';
var ADDED        = 'topicAdded';
var REMOVED      = 'topicRemoved';
var CONNECTED    = 'connected';


var CLOSE_NORMAL  = 1000;
var CLOSE_BAD_KEY = 4403;



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
  reader(this, 'multi', !(options && options.apiKey));

  if (!this.multi) {
    options.headers = options.headers || {};
    options.headers['Zotero-API-Key'] = options.apiKey;

    delete options.apiKey;
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
   * @type Subscriptions
   */
  this.subscriptions = new Subscriptions();

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

  var addr = this.url;

  debug('opening websocket to %s...', addr);

  /**
   * The WebSocket to the Zotero API server.
   *
   * @property socket
   * @type WebSocket
   */
  this.socket = new WS(addr, this.options);
  this.bind();

  return this;
};

/**
 * Binds internal event handlers to the WebSocket.
 *
 * @method bind
 * @private
 */
Stream.prototype.bind = function () {
  assert(this.socket);

  this.socket
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

  if (this.retry.timeout) {
    clearTimeout(this.retry.timeout);
    delete this.retry.timeout;
  }

  if (!this.subscriptions.empty) {
    this.subscribe(this.subscriptions.all.slice());
  }

  this.subscriptions.clear();

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

  if (code === CLOSE_NORMAL || code === CLOSE_BAD_KEY) {
    debug('websocket closed');

  } else {
    debug('websocket closed unexpectedly, retry in %dms', this.retry.delay);

    if (this.retry.timeout) {
      clearTimeout(this.retry.timeout);
      delete this.retry.timeout;
    }

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
 * Parses the message body and updates the subscription
 * list (if necessary); emits an event for the message's
 * event type.
 *
 * @method receive
 * @private
 */
Stream.prototype.receive = function (message, flags) {
  try {
    validate(flags);

    var data = JSON.parse(message);
    var type = data.event;

    debug('"%s" message received', type);
    debug('%s', message);

    switch (type) {

    case CONNECTED:
      data = pick(data, 'topics', 'retry');

      if (data.retry)
        this.retry.delay = Number(data.retry) || Stream.DEFAULT_RETRY;

      if (data.topics)
        this.subscriptions.update([{ topics: data.topics }]);

      this.emit(type, data);
      break;

    case SUBSCRIBED:
      this.subscriptions.update(data.subscriptions);
      this.emit(type, data.subscriptions, data.errors);
      break;

    case UNSUBSCRIBED:
      this.emit(type);
      break;

    case ADDED:
      this.subscriptions.add(pick(data, 'topic', 'apiKey'));
      this.emit(type, pick(data, 'topic', 'apiKey'));
      break;

    case REMOVED:
      this.subscriptions.remove(pick(data, 'topic', 'apiKey'));
      this.emit(type, pick(data, 'topic', 'apiKey'));
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

  var self = this;
  var message = JSON.stringify(data);

  debug('sending "%s" message', data.action);
  debug('%s', message);

  this.socket.send(message, function (error) {
    if (typeof callback === 'function')
      callback(error, data);

    self.emit(data.action, error, data);
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

  if (this.socket.readyState < WS.CLOSING) {
    debug('closing websocket...');
    this.socket.close(CLOSE_NORMAL);
  }

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

  assert(subscriptions.length);

  if (!this.socket || this.socket.readyState !== WS.OPEN) {
    this.subscriptions.update(subscriptions);

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

  this.subscriptions.cancel(subscriptions);

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


// --- Subscriptions ---

/**
 * Manages a Stream's subscription list.
 *
 * A subscription is a plain object with
 * properties `apiKey` and `topics`.
 *
 * @class Subscriptions
 * @constructor
 */
function Subscriptions() {
  /**
   * A list of all subscription objects.
   *
   * @property all
   * @type Object
   */
  this.all = [];
}

/**
 * @property empty
 * @type Boolean
 */
reader(Subscriptions.prototype, 'empty', function () {
  return this.all.length === 0;
});

/**
 * A list of all subscription topics.
 *
 * @property topics
 * @type Array<String>
 */
reader(Subscriptions.prototype, 'topics', function () {
  return this.all.reduce(function (topics, s) {
    topics.push.apply(topics, s.topics);
    return topics;

  }, []);
});


/**
 * Clears the list of subscriptions immediately.
 *
 * @method clear
 * @chainable
 */
Subscriptions.prototype.clear = function () {
  this.all.length = 0;
  return this;
};

/**
 * Returns the subscription for the given key.
 *
 * @method get
 * @returns {Object} the subscription
 */
Subscriptions.prototype.get = function (key) {
  return find(this.all, by(key));
};


/**
 * Adds a single topic to a Subscription.
 *
 * @method add
 * @chainable
 */
Subscriptions.prototype.add = function (subscription) {
  assert(subscription.topic);

  var s = this.get(subscription.apiKey);

  assert(s);

  s.topics = s.topics || [];
  s.topics.push(subscription.topic);

  return this;
};


/**
 * Removes a single topic from a Subscription.
 *
 * @method remove
 * @chainable
 */
Subscriptions.prototype.remove = function (subscription) {
  assert(subscription.topic);

  var s = this.get(subscription.apiKey);

  if (s) {
    var idx = s.topics.indexOf(subscription.topic);
    if (idx !== -1) s.topics.splice(idx, 1);
  }

  return this;
};


Subscriptions.prototype.update = function (subscriptions) {
  var i, ii, s, subscription;

  for (i = 0, ii = subscriptions.length; i < ii; ++i) {
    subscription = subscriptions[i];

    s = this.get(subscription.apiKey);

    if (s)
      s.topics = subscription.topics || [];
    else
      this.all.push(subscription);

  }

  return this;
};


Subscriptions.prototype.cancel = function (subscriptions) {
  var i, ii, idx, subscription;

  for (i = 0, ii = subscriptions.length; i < ii; ++i) {
    subscription = subscriptions[i];

    if (subscription.topic) {
      this.remove(subscription);

    } else {

      idx = index(this.all, by(subscription.apiKey));
      if (idx !== -1) this.all.splice(idx, 1);

    }
  }

  return this;
};
// --- Private Helpers ---

function validate(flags) {
  if (!flags) return false;

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

function by(key) {
  return function (s) { return (s.apiKey === key); };
}

// --- Module Exports ---
Stream.Subscriptions = Subscriptions;
module.exports = Stream;
