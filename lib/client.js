// --- Dependencies ---

var EventEmitter = require('events').EventEmitter;
var qs = require('querystring');
var inherits = require('util').inherits;

var debug = require('debug')('zotero:client');

var Message = require('./message');
var pkg = require('../package.json');

var utils = require('./utils');
var extend = utils.extend;
var once = utils.once;


/** @module zotero */


/**
 * Creates a Zotero Client instance. A Client manages HTTPS connections
 * to Zotero API servers.
 *
 * @class Client
 * @constructor
 * @extends events.EventEmitter
 *
 * @param {Object} options - override the default configuration.
 */
function Client(options) {
  EventEmitter.call(this);

  this.options = extend({}, Client.defaults, options);
  this.state = new ClientState(this);
  this.messages = [];
}

inherits(Client, EventEmitter);

/**
 * Client default configuration.
 *
 * @property defaults
 * @type Object
 * @static
 */
Client.defaults = {
  host: 'api.zotero.org',
  port: 443,

  headers: {
    'Zotero-API-Version': '3',
    'User-Agent': ['zotero-node', pkg.version].join('/')
  }
};

Object.defineProperties(Client.prototype, {
  persist: {
    get: function () {
      return this.options.headers.Connection === 'keep-alive';
    },
    set: function (value) {
      if (value) {
        this.options.headers.Connection = 'keep-alive';
      } else {
        delete this.options.headers.Connection;
      }
    }
  }
});


// --- Client Helpers ---

function noop() {}

var is = {
  redirect: function (code) { return code >= 300 && code < 400; },
  func:     function (obj)  { return typeof obj === 'function'; }
};


// --- Client Prototype ---


/**
 * Sends an HTTPS request to the Zotero API. If the client
 * is currently in limited state, the sending of the request
 * will be delayed.
 *
 * @method request
 *
 * @param {Object} options
 *   The request options to be passed to `https.request`.
 * @param {String} [data]
 * @param {Function} callback
 *
 * @return {Message} The Zotero API message object.
 */
Client.prototype.request = function (options, data, callback) {
  debug('#request %j', options);

  options = extend({}, this.options, options);
  callback = once(callback || noop);

  var self = this;
  var message = new Message(options);

  message.once('received', function () {
    self.state.parse(message);
    callback(message.error, message);
  });

  message.once('error', function (error) {
    callback(error, message);
  });

  this.messages.push(message);

  process.nextTick(this.flush.bind(this));

  return message;
};

/**
 * Flushes the client's outbound message queue. If the client
 * is currently rate-limited, the process will be delayed.
 * If you want to force flushing the queue, use the `force`
 * parameter.
 *
 * If the process is delayed, the respective timeout will
 * be stored in `client.state.delayed`.
 *
 * @method flush
 * @chainable
 *
 * @param {Boolean} [force] If set to true, flush the queue
 *   even if the client is currently rate-limited.
 */
Client.prototype.flush = function (force) {
  if (force) {
    clearTimeout(this.state.delayed);
    this.state.delayed = undefined;
  }

  if (!this.state.delayed) {
    var delay = !force && this.state.limited;

    if (delay) {
      debug('is rate-limited: delaying flush for %d seconds', delay / 1000.0);
      this.state.delayed =
        setTimeout(this.flush.bind(this, true), delay);

    } else {

      debug('flushing %d outbound message(s)', this.messages.length);
      while (this.messages.length) this.messages.shift().send();
    }
  }

  return this;
};

/**
 * Issues a GET request to the Zotero API. See the `#request`
 * method for further details.
 *
 * @method get
 *
 * @example
 *     client.get('/users/42/items', { format: 'versions' });
 *     //-> sends request to /users/42/items?format=versions
 *
 * @param {String} path The API destination path.
 * @param {Object} [options] The request parameters.
 * @param {Function} [callback]
 *
 * @return {Message} The Zotero API message object.
 */
Client.prototype.get = function (path, options, callback) {
  if (arguments.length === 2 && is.func(options)) {
    callback = options; options = null;
  }

  debug('#get "%s", %j', path, options);

  return this.request({
    method: 'GET',
    path: path + this.query(options)

  }, null, callback);
};

/**
 * Turns the passed in `options` object into a query string.
 *
 * @method query
 * @param {Object} options
 * @return {String} The query string for `options`.
 */
Client.prototype.query = function (options) {
  var string = qs.stringify(options);
  if (string.length) string = '?' + string;

  return string;
};

// --- ClientState ---

/**
 * Keeps track of a rate-limits or backoff directives issued
 * by the Zotero API servers.
 *
 * @class ClientState
 * @constructor
 *
 * @param {Client} client The associated client instance.
 */
function ClientState(client) {

  /**
   * The associated client instance.
   *
   * @property client
   * @type Client
   */
  this.client = client;

  /**
   * The time (in milliseconds) to wait before the next request
   * may be sent to the API; this value is only updated upon
   * reception of a server response and thus valid only in
   * combination with the time of reception.
   *
   * @property retry
   * @type Number
   */
  this.retry = 0;

  /**
   * The time (in milliseconds) the client should back-off
   * before resuming normal API interactions; this value is
   * only updated upon reception of a server response and
   * thus valid only in combination with the time of reception.
   *
   * @property backoff
   * @type Number
   */
  this.backoff = 0;

  /**
   * The HTTP status code of the last response received
   * by the client.
   *
   * @property code
   * @type Number|null
   */
  this.code = null;

  /**
   * The UNIX timestamp of the last API response received
   * by the client.
   *
   * @property timestamp
   * @type Number
   */
  this.timestamp = Date.now();
}


/**
 * Parses the passed-in HTTP status code and headers
 * and updates the current state accordingly.
 *
 * @method parse
 * @chainable
 *
 * @param {Message} message The message.
 */
ClientState.prototype.parse = function (message) {
  debug('state#parse headers %j', message.headers);

  this.code = message.code;
  this.timestamp = Date.now();

  this.retry = 1000 * parseInt(message.headers['retry-after'], 10) || 0;
  this.backoff = 1000 * parseInt(message.headers['backoff'], 10) || 0;

  return this;
};

Object.defineProperties(ClientState.prototype, {

  /**
   * The time (in milliseconds) to wait before the next request
   * may be sent regularly to the API. This is either `retry`
   * or `backoff` (whichever is higher) minus the number of
   * seconds elapsed since the reception of the last message.
   *
   * As a consequence, `limited` can be used to check whether
   * or not the client is currently allowed to send messages
   * (when the value is zero) or supposed to wait (when the
   * value is non-zero).
   *
   * @property limited
   * @type Number
   */
  limited: {
    get: function () {
      var delta = Math.max(this.retry, this.backoff);

      if (!delta) return delta;

      return Math.max(0, (this.timestamp + delta) - Date.now());
    }
  },

  /**
   * The (human readable) reason why the client is currently
   * in limited mode.
   *
   * @property reason
   * @type String|undefined
   */
  reason: {
    get: function () {
      if (!this.limited) return undefined;

      var reasons = [];

      if (this.backoff) reasons.push('overload');

      if (this.retry) {
        switch (this.code) {
        case 429:
          reasons.push('too many requests');
          break;
        case 503:
          reasons.push('service unavailable');
          break;
        default:
          reasons.push('unknown');
        }
      }

      return reasons.join('; ');
    }
  }
});

// --- Exports ---
exports = module.exports = Client;
