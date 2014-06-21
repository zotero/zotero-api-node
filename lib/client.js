// --- Dependencies ---

var https = require('https');
var EventEmitter = require('events').EventEmitter;
var qs = require('querystring');
var inherits = require('util').inherits;

var debug = require('debug')('zotero:client');
var mime = require('mime-types');

var pkg = require('../package.json');

var utils = require('./utils');
var extend = utils.extend;
var downcase = utils.downcase;


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
    'User-Agent': 'zotero-node/' + pkg.version
  }
};


// --- Client Helpers ---

function noop() {}

var is = {
  redirect: function (code) { return code >= 300 && code < 400; },
  ok:       function (code) { return code >= 200 && code < 300; },

  func:     function (obj)  { return typeof obj === 'function'; }
};


// --- Client Prototype ---

/**
 * Handles incoming HTTP responses. The passed-in callback
 * will be called with the message body when it has been
 * received and parsed.
 *
 * @method receive
 * @chainable
 *
 * @param {http.IncomingMessage} message
 * @param {Function} callback
 */
Client.prototype.receive = function (message, callback) {
  var self = this;
  var code = message.statusCode;
  var error;
  var encoding = mime.charset(message.headers['content-type']);
  var data = [];
  var size = 0;

  debug('#receive %d', code);

  this.state.parse(code, message.headers);

  message.on('data', function receiving(chunk) {
    size += chunk.length;
    data.push(chunk);
  });

  message.on('end', function received() {
    data = Buffer.concat(data, size);
    data = data.toString(encoding);

    if (!is.ok(code)) {
      error = new Error(data);
      error.code = code;
    }

    self.emit('received', error, data, message);
    callback.apply(self, [error, data, message]);
  });

  return this;
};


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
 * @return {http.ClientRequest} The request object.
 */
Client.prototype.request = function (options, data, callback) {
  debug('#request %j', options);

  options = extend({}, this.options, options);
  callback = callback || noop;

  var self = this;
  var req = https.request(options);

  req.on('response', function (message) {
    debug('#request response received');

    self.emit('response', message);

    message.headers = downcase(message.headers);

    if (is.redirect(message.statusCode) && message.headers['location']) {
      callback.apply(self, ['redirect not implemented yet', message]);
      message.resume(); // required?

    } else {
      self.receive(message, callback);
    }
  });

  req.on('error', function (error) {
    debug('#request failed: %s', error.message);

    self.emit('error', error);
    callback.apply(self, [error]);
  });

  //if (data) {
  //  req.setHeader('Content-Length', Buffer.byteLength(data));
  //  req.write(data);
  //}

  var send = function () { req.end(); self.emit('request', req); };

  if (this.state.limited) {
    setTimeout(send, this.state.limited);

  } else {
    send();
  }

  return req;
};

/**
 * Issues a GET request to the Zotero API.
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
 * @return {http.ClientRequest} The request object.
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
 * @param {Number} code The HTTP status code.
 * @param {Object} headers The HTTP headers.
 */
ClientState.prototype.parse = function (code, headers) {
  debug('state#parse headers %j', headers);

  this.code = code;
  this.timestamp = Date.now();

  this.retry = 1000 * parseInt(headers['retry-after'], 10) || 0;
  this.backoff = 1000 * parseInt(headers['backoff'], 10) || 0;

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
