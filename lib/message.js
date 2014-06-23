// --- Dependencies ---

var Readable = require('stream').Readable;
var inherits = require('util').inherits;

var debug = require('debug')('zotero:message');
var mime = require('mime-types');

var utils = require('./utils');
var extend = utils.extend;
var downcase = utils.downcase;


/** @module zotero */

/**
 * A Zotero API response message.
 *
 * @class Message
 * @constructor
 * @extends stream.Readable
 */
function Message(client, req, res) {
  Readable.call(this);
  
  var self = this;
  var data = [];
  var size = 0;

  /**
   * @property client
   * @type Client
   */
  this.client = client;

  /**
   * @property req
   * @type http.ClientRequest
   */
  this.req = req;

  /**
   * @property res
   * @type http.IncomingMessage
   */
  this.res = res;

  this.headers = downcase(res.headers);

  res.setEncoding(this.encoding);

  res.on('data', function receiving(chunk) {
    size += chunk.length;
    data.push(chunk);
    self.emit('data', chunk);
  });

  res.on('end', function received() {
    data = Buffer.concat(data, size);
    self.data = self.parse(data);
    self.emit('end');
  });

  res.on('readable', this.emit.bind(this, 'readable'));
  res.on('close', this.emit.bind(this, 'close'));
  res.on('error', this.emit.bind(this, 'error'));
}

inherits(Message, Readable);

Object.defineProperties(Message.prototype, {

  encoding: {
    get: function () {
      return mime.charset(this.headers['content-type']);
    }
  },

  type: {
    get: function () {
      return mime.extension(this.headers['content-type']);
    }
  },

  code: {
    get: function () { return this.res.statusCode; }
  },

  ok: {
    get: function () { return this.code >= 200 && this.code < 300; }
  },

  error: {
    get: function () {
      if (this.ok) return undefined;

      var error = new Error(this.type === 'txt' ? this.data : 'unknown');
      error.code = this.code;

      return error;
    }
  }

});


// --- Message Prototype Methods ---

/**
 * Parses a Zotero API response body if a parser for
 * the content type is available.
 *
 * @method parse
 *
 * @param {String|Buffer} data The content as a string.
 *
 * @return {Object|String} The parsed content, or the string
 *   if the content could not be parsed.
 */
Message.prototype.parse = function (data) {
  debug('#parse called for "%s"', this.type);

  var p = Message.parsers[this.type];

  if (!p) {
    debug('#parse no matching body parser available');
    return data;
  }

  try {
    debug('#parse attempting to parse %j', data);
    return p.call(this, data);

  } catch (error) {
    debug('#parse failed to parse data: %s', error.message);

    return data;
  }
};

// --- Stream Implementation ---

Message.prototype.destroy = function () {
  return this.res.destroy.apply(this.res, arguments);
};

Message.prototype.pause = function () {
  return this.res.pause.apply(this.res, arguments);
};

Message.prototype.resume = function () {
  return this.res.resume.apply(this.res, arguments);
};


// --- Message Parsers ---

/**
 * The available Zotero API response body parsers.
 *
 * @property parsers
 * @type Object
 * @static
 */
Message.parsers = {
  json: function (data) { return JSON.parse(data.toString(this.encoding)); }
};

// --- Exports ---
exports = module.exports = Message;
