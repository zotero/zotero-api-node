// --- Dependencies ---

var https = require('https');
var EventEmitter = require('events').EventEmitter;
var qs = require('querystring');

var debug = require('debug')('zotero:client');

var utils = require('./utils');
var extend = utils.extend;
var downcase = utils.downcase;


/** @module zotero/client */

/**
 * Creates a Zotero Client instance. A Client manages HTTPS connections
 * to Zotero API servers.
 *
 * @constructor
 */
function Client(options) {
  this.options = extend({}, Client.defaults, options);
  this.state = new ClientState(this);
}

// Clients are EventEmitters
Client.prototype = new EventEmitter();

/**
 * Client default configuration.
 *
 * @namespace
 *
 * @property {string} host - The API server's hostname (api.zotero.org).
 * @property {number} port - The API server's port (443).
 */
Client.defaults = {
  host: 'api.zotero.org',
  port: 443,

  headers: {
    'Zotero-API-Version': '2',
    'User-Agent': 'zotero-node'
  }
};

// --- Client Helpers ---

function noop() {}

var is = {
  redirect: function (code) { return code >= 300 && code < 400; },
  ok:       function (code) { return code >= 200 && code < 300; }
};


// --- Client Prototype ---


Client.prototype.receive = function receive(message, callback) {
  debug('#receive %d', message.statusCode);

  this.emit('response', message);

  var headers = downcase(message.headers);
  var code = message.statusCode;

  this.state.parse(headers);

  if (is.redirect(code) && headers['location']) {
    this.emit('error', 'redirect not implemented yet');

  } else {
    res.setEncoding('utf8');
  }
};


/**
 * Sends an HTTPS request to the Zotero API
 * @returns {this} the client.
 */
Client.prototype.request = function request(options, data, callback) {
  debug('#request %j', options);

  options = extend({}, this.options, options);
  callback = callback || noop;

  var self = this;
  var req = https.request(options);

  req.on('response', function (message) {
    debug('#request response received');

    message.headers = downcase(message.headers);

    if (is.redirect(message.statusCode) && message.headers['location']) {
      callback.apply(self, ['redirect not implemented yet', message]);

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

Client.prototype.get = function get(path, options, callback) {
  debug('#get "%s", %j', path, options);

  return this.request({
    method: 'GET',
    path: path + qs.stringify(options)

  }, null, callback);
};


// --- ClientState ---

function ClientState(client) {
  this.client = client;
}

ClientState.prototype.parse = function (headers) {
  debug('state #parse headers %j', headers);
};


// --- Exports ---
exports = module.exports = Client;
