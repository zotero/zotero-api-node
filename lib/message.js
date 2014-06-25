// --- Dependencies ---

var Readable = require('stream').Readable;
var inherits = require('util').inherits;
var https = require('https');

var debug = require('debug')('zotero:message');
var mime = require('mime-types');

var utils = require('./utils');
var downcase = utils.downcase;


/** @module zotero */

/**
 * A Zotero API message contains an API response and
 * the corresponding request object.
 *
 * @class Message
 * @constructor
 * @extends stream.Readable
 */
function Message(options) {
  Readable.call(this);
  if (options) this.bind(options);
}

inherits(Message, Readable);


Object.defineProperties(Message.prototype, {

  /**
   * The corresponding HTTP request.
   *
   * @property req
   * @type http.ClientRequest
   */

  /**
   * The corresonding HTTP response.
   *
   * @property res
   * @type http.IncomingMessage
   */


  /**
   * The HTTP response headers.
   *
   * @property headers
   * @type Object
   */
  headers: {
    get: function () {
      return this.res && this.res.headers;
    }
  },

  /**
   * The encoding of the response body, inferred from
   * the response's `Content-Type` header. 
   *
   * @property encoding
   * @type String
   */
  encoding: {
    get: function () {
      if (!this.res) return undefined;
      return mime.charset(this.headers['content-type']);
    }
  },

  /**
   * The file type of the response body's content, inferred
   * from the response's `Content-Type` header. 
   *
   * This value is used to select a suitable message parser.
   *
   * @property type
   * @type String
   */
  type: {
    get: function () {
      if (!this.res) return undefined;
      return mime.extension(this.headers['content-type']);
    }
  },

  /**
   * The response's HTTP status code.
   *
   * @property code
   * @type Number
   */
  code: {
    get: function () {
      return this.res && this.res.statusCode;
    }
  },

  /**
   * Whether or not the response message has an OK status.
   *
   * @property ok
   * @type Boolean
   */
  ok: {
    get: function () { return this.code >= 200 && this.code < 300; }
  },


  /**
   * If the HTTP response was not OK, returns an associated
   * error object; undefined otherwise.
   *
   * @property error
   * @type Error
   */
  error: {
    get: function () {
      if (!this.resolved || this.ok) return undefined;

      var error = new Error(this.type === 'txt' ? this.data : 'unknown');
      error.code = this.code;

      return error;
    }
  }

});


// --- Message Prototype Methods ---

Message.prototype.reset = function () {
  if (this.req) {
    this.req.removeAllListeners();
    delete this.req;
  }

  if (this.res) {
    this.res.removeAllListeners();
    delete this.res;
  }

  delete this.resolved;
  delete this.data;

  return this;
};

Message.prototype.bind = function (options) {
  debug('binding new http request...');

  var req = https.request(options);

  this.reset();
  reader(this, 'req', req);

  req.on('response', this.receive.bind(this));
  req.on('error', this.emit.bind(this, 'error'));

  this.emit('request', req);

  return this;
};


Message.prototype.receive = function (res) {
  debug('http response received...');

  var self = this;
  var data = [];
  var size = 0;

  function receiving(chunk) {
    size += chunk.length;
    data.push(chunk);
    self.emit('data', chunk);
  }

  res.headers = downcase(res.headers);
  reader(this, 'res', res);

  if (this.encoding) res.setEncoding(this.encoding);

  res.on('data', receiving);

  res.once('end', function () {
    debug('receiving response data complete: %d bytes read', size);

    res.removeListener('data', receiving);

    data = Buffer.concat(data, size);
    self.data = self.parse(data);

    reader(self, 'resolved', true);

    self.emit('received');
  });


  res.on('readable', this.emit.bind(this, 'readable'));
  res.on('close', this.emit.bind(this, 'close'));
  res.on('error', this.emit.bind(this, 'error'));

  this.emit('response', res);

  return this;
};

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
  var p = Message.parsers[this.type];

  if (!p) {
    debug('no parser available for "%s"', this.type);
    return data;
  }

  try {
    debug('attempting to parse "%s" data', this.type);
    return p.call(this, data);

  } catch (error) {
    debug('failed to parse data: %s', error.message);

    return data;
  }
};

Message.prototype.send = function () {
  if (!this.req) throw new Error('message not bound to a request yet');

  // check if the message was sent?
  this.req.end();

  this.emit('sent', this);

  return this;
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

// --- Helpers ---

function property(obj, name, descriptor) {
  Object.defineProperty(obj, name, descriptor);
}

function reader(obj, name, value) {
  var descriptor = { configurable: true };

  if (typeof value === 'function') {
    descriptor.get = value; 
  } else {
    descriptor.value = value;
  }

  property(obj, name, descriptor);
}

// --- Exports ---
exports = module.exports = Message;
