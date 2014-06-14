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


var is = {
  redirect: function (res) {
    return res.statusCode >= 300 && res.statusCode < 400 && res.headers['location'];
  },
  ok: function (res) {
    return res.statusCode >= 200 && res.statusCode < 300;
  }
};


// --- Client Prototype ---


Client.prototype.request = function request(options, callback) {
  debug('#request %j', options);

  options = extend({}, this.options, options);

  var self = this;
  var req = https.request(options);

  req.on('response', function response(message) {
    message.headers = downcase(message.headers);

    if (is.redirect(message)) {
      debug('redirect not implemented yet');

    } else {
      res.setEncoding('utf8');
    }
  });

  req.on('error', function (error) {
    debug('#request error: %s', error.message);
    self.emit('error', error);
  });

  req.end();

  return this;
};

Client.prototype.get = function get(path, options, callback) {
  debug('#get "%s", %j', path, options);

  return this.request({
    method: 'GET',
    path: path + qs.stringify(options)

  }, callback);
};

// --- Exports ---
exports = module.exports = Client;
