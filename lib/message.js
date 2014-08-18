// --- Dependencies ---

var Readable = require('stream').Readable;
var inherits = require('util').inherits;
var https = require('https');

var debug = require('debug')('zotero:message');
var mime = require('mime-types');

var utils = require('./utils');
var downcase = utils.downcase;
var noop = utils.noop;


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
   * The API path called by the message.
   *
   * @property path
   * @type String
   */
  path: {
    get: function () {
      return this.req && this.req.path;
    }
  },

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

  total: {
    get: function () {
      if (!this.res) return undefined;
      return parseInt(this.headers['total-results'], 10);
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

Message.prototype.isList = function () {
  return this.type === 'json' && Array.isArray(this.data);
};

/**
 * Resets the message state; use if you need to reuse
 * a message object.
 *
 * @method reset
 * @chainable
 * @private
 */
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
  delete this.sent;
  delete this.data;

  return this;
};

/**
 * Creates a new HTTP request and binds it to this
 * message; this will automatically set up the
 * message to receive and bind the corresponding
 * HTTP response as well.
 *
 * @method bind
 * @chainable
 *
 * @params {Object} options For `https.request`.
 */
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


/**
 * Receives an HTTP response and binds it to
 * this message.
 *
 * @method receive
 * @chainable
 * @private
 *
 * @param {http.IncomingMessage} res
 */
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

  //if (this.encoding) res.setEncoding(this.encoding);

  res.on('data', receiving);

  res.once('end', function received() {
    debug('receiving response data complete: %d bytes read', size);

    res.removeListener('data', receiving);

    data = Buffer.concat(data, size);

    self.parse(data, self.type, function (error, result) {
      if (error) {
        debug('failed to parse data: %s', error.message);
        self.data = data;

      } else {
        self.data = result;
      }

      reader(self, 'resolved', true);
      self.emit('received');
    });
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
 * @chainable
 *
 * @param {String|Buffer} data The content as a string.
 * @param {String} [type = this.type] The data's content type.
 * @param {Function} callback Will be called with the parse results.
 */
Message.prototype.parse = function (data, type, callback) {
  type = type || this.type;
  callback = callback || noop;

  var p = Message.parsers[type];

  if (!p) {
    debug('no parser available for "%s"', type);
    process.nextTick(callback.bind(this, false, data.toString(this.encoding)));

  } else {
    debug('attempting to parse "%s" data', type);
    process.nextTick(p.bind(this, data, callback));
  }

  return this;
};

/**
 * Sends the Message's request to the Zotero server.
 *
 * @method send
 * @chainable
 * @private
 */
Message.prototype.send = function () {
  if (!this.req) throw new Error('message not bound to a request yet');
  if (this.sent) return this;

  this.req.end();

  reader(this, 'sent', true);
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

mime.define({
  'application/vnd.citationstyles.csl+json': ['json']
});

/**
 * The available Zotero API response body parsers.
 *
 * @property parsers
 * @type Object
 * @static
 */
Message.parsers = {
  json: function (data, callback) {
    try {
      callback(false, JSON.parse(data.toString(this.encoding)));

    } catch (error) {
      callback(error, data);
    }
  }
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
