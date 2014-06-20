// --- Dependencies ---

var https = require('https');
var EventEmitter = require('events').EventEmitter;
var qs = require('querystring');

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
 *
 * @param {Object} options - override the default configuration.
 */
function Client(options) {
  EventEmitter.call(this);

  this.options = extend({}, Client.defaults, options);
  this.state = new ClientState(this);
}

// Clients are EventEmitters
Client.prototype = new EventEmitter();

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
  var error = !is.ok(code);
  var encoding = mime.charset(message.headers['content-type']);
  var data = [];
  var size = 0;

  debug('#receive %d', code);

  this.state.parse(message.headers);

  message.on('data', function (chunk) {
    size += chunk.length;
    data.push(chunk);
  });

  message.on('end', function () {
    data = Buffer.concat(data, size);
    data = data.toString(encoding);

    self.emit('received', error, data, message);
    callback.apply(self, [error, data, message]);
  })

  return this;
};


/**
 * Sends an HTTPS request to the Zotero API
 * @return {this} the client.
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

  req.end();

  this.emit('request', req);

  return this;
};

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
 * @method query
 * @param {Object} options
 * @return {String} the query string for `options`.
 */
Client.prototype.query = function (options) {
  var string = qs.stringify(options);
  if (string.length) string = '?' + string; 

  return string;
};

// --- ClientState ---

function ClientState(client) {
  this.client = client;
}

ClientState.prototype.parse = function (headers) {
  debug('state#parse headers %j', headers);
  // TODO rate limiting etc.
};


// --- Exports ---
exports = module.exports = Client;
