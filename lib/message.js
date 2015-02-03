'use strict';

// --- Dependencies ---

var Stream = require('stream');
var assert = require('assert');
var https = require('https');
var inherits = require('util').inherits;
var qs = require('querystring');
var url = require('url');

var debug = require('debug')('zotero:message');
var mime = require('mime-types');

var utils = require('./utils');
var downcase = utils.downcase;
var extend = utils.extend;
var noop = utils.noop;


/** @module zotero */

/**
 * A Zotero API message contains an API response and
 * the corresponding request object.
 *
 * @class Message
 * @constructor
 * @extends Stream
 */
function Message(options) {
  Stream.call(this);
  if (options) this.bind(options);
}

inherits(Message, Stream);

// Limit the number of redirects to follow to avoid loops!
Message.MAX_REDIRECTS = 5;


Object.defineProperties(Message.prototype, {

  /**
   * The full API path called by the message.
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
   * The encoding of the response body, inferred from
   * the response's `Content-Type` header.
   *
   * @property encoding
   * @type String
   */
  encoding: {
    get: function () {
      if (!this.headers) return undefined;
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
      if (!this.headers) return undefined;
      return mime.extension(this.headers['content-type']) || undefined;
    }
  },

  /**
   * The total number of results for this request for
   * multi-object requests; undefined for other requests.
   *
   * @property total
   * @type Number
   */
  total: {
    get: function () {
      if (!this.headers) return undefined;
      return parseInt(this.headers['total-results'], 10);
    }
  },

  /**
   * Whether or not this is a multi-object response.
   * This is the case if the `Total-Results` header
   * is present.
   *
   * @property multi
   * @type Boolean
   */
  multi: {
    get: function () {
      return this.total !== undefined;
    }
  },

  /**
   * Whether or not there are more objects available
   * for the Message's path. This is the case if a
   * `next` URL is present in the response's `Link`
   * header.
   *
   * @property done
   * @type Boolean
   */
  done: {
    get: function () {
      return !(this.links && this.links.next);
    }
  },

  /**
   * The `Last-Modified-Version` header as an integer.
   *
   * @property version
   * @type Number
   */
  version: {
    get: function () {
      if (!this.headers) return undefined;
      return parseInt(this.headers['last-modified-version'], 10);
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
   * Whether or not the response message was not modified.
   *
   * @property unmodified
   * @type Boolean
   */
  unmodified: {
    get: function () { return this.code === 304; }
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
      if (!this.received || this.ok || this.unmodified)
        return undefined;

      var error = new Error(this.text || 'unknown');
      error.code = this.code;

      return error;
    }
  },

  text: {
    get: function () {
      switch (this.type) {
      case 'txt':
      case 'html':
        return this.data;
      default:
        return undefined;
      }
    }
  }
});


// --- Message Prototype Methods ---

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

  this.redirects = [];

  delete this.client;
  delete this.data;
  delete this.headers;
  delete this.links;
  delete this.options;
  delete this.received;
  delete this.sent;

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

  this.reset();
  var req = https.request(options);

  /**
   * The HTTP request options.
   *
   * @property options
   * @type Object
   */
  reader(this, 'options', options);

  /**
   * The corresponding HTTP request.
   *
   * @property req
   * @type http.ClientRequest
   */
  reader(this, 'req', req);

  req.on('response', this.resolve.bind(this));
  req.on('error', this.emit.bind(this, 'error'));

  this.emit('request', req);

  return this;
};


/**
 * Resolves HTTP redirects (if any) and before
 * receiving a response.
 *
 * @method resolve
 * @chainable
 * @private
 *
 * @param {http.IncomingMessage} res
 */
Message.prototype.resolve = function (res) {
  if (res.statusCode === 302 || res.statusCode === 301) {
    var target = downcase(res.headers).location;

    if (target && this.redirects.length < Message.MAX_REDIRECTS) {
      debug('following redirect to "%s"...', target);

      var req = https.request(url.parse(target));

      req.on('response', this.resolve.bind(this));
      req.on('error', this.emit.bind(this, 'error'));

      req.end();

      this.redirects.push(req);

      return this;
    }
  }

  return this.receive(res);
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

  /**
   * The corresonding HTTP response.
   *
   * @property res
   * @type http.IncomingMessage
   */
  reader(this, 'res', res);

  /**
   * The HTTP response headers.
   *
   * Note: This is a copy of `res.headers`, but all header
   * names are normalized to lower case.
   *
   * @property headers
   * @type Object
   */
  reader(this, 'headers', downcase(res.headers));


  /**
   * The links given in the Message's HTTP `Link` header.
   * Typically, multi-object responses will contain a
   * `next` and `last` link.
   *
   * Each link is an object with a `path` and `options`
   * value that can be passed to `Client#get`.
   *
   * @property links
   * @type Object
   */
  reader(this, 'links', Link.parse(this.headers.link));


  // Receive Data

  function receiving(chunk) {
    size += chunk.length;
    data.push(chunk);
    self.emit('data', chunk);
  }

  res.on('data', receiving);

  res.once('end', function received() {
    debug('response received with status %d: %d bytes read',
      self.code, size);

    res.removeListener('data', receiving);

    data = Buffer.concat(data, size);

    self.parse(data, self.type, function (error, result) {
      if (error) {
        debug('failed to parse data: %s', error.message);
        self.data = data;

      } else {
        self.data = result;
      }

      /**
       * Whether or not the Message has been fully
       * received and parsed.
       *
       * @property received
       * @type Boolean
       */
      reader(self, 'received', true);

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

  var p = type && Message.parsers[type];

  if (p) {
    debug('attempting to parse "%s" data', type);
    process.nextTick(p.bind(this, data, callback));

  } else {
    if (type)
      debug('no parser available for "%s"', type);

    process.nextTick(callback.bind(this, false, data));
  }

  return this;
};


/**
 * Sends the Message's request to the Zotero server.
 *
 * @method send
 * @chainable
 *
 * @private
 *
 * @param {Client} [client]
 */
Message.prototype.send = function (client) {
  if (this.sent) return this;

  assert(this.req, 'message not bound to a request yet');

  reader(this, 'client', client);
  this.req.end();

  /**
   * Whether or not the Message has been sent.
   *
   * @property sent
   * @type Boolean
   */
  reader(this, 'sent', true);
  this.emit('sent', this);

  return this;
};


/**
 * Sends a duplicate request to the API server/
 *
 * @param {Function} [callback]
 * @returns {Message} The duplicate message.
 */
Message.prototype.retry = function (callback) {
  assert(this.client, 'cannot retry sending message: no associated client');

  return this.client
    .request(extend({}, this.options), callback);
};

Message.prototype.next = function (callback) {
  if (this.done) return null;

  assert(this.client, 'cannot send next message: no associated client');

  var link = this.links.next;
  var headers = extend({}, this.options.headers);

  return this.client
    .get(link.path, link.options, headers, callback);
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
      var parsed = JSON.parse(data.toString(this.encoding));

    } catch (error) {
      return callback(error, data);
    }

    return callback(null, parsed);

  },

  txt: function (data, callback) {
    try {
      var parsed = data.toString(this.encoding);

    } catch (error) {
      return callback(error, data);
    }

    return callback(null, parsed);
  }
};

Message.parsers.html = Message.parsers.txt;

// --- Helpers ---

function property(obj, name, descriptor) {
  Object.defineProperty(obj, name, descriptor);
}

function reader(obj, name, value) {
  var descriptor = { configurable: true, enumerable: false };

  if (typeof value === 'function') {
    descriptor.get = value;
  } else {
    descriptor.value = value;
  }

  property(obj, name, descriptor);
}


function Link(string) {
  var p = url.parse(string);

  this.path = p.pathname;

  if (p.query)
    this.options = qs.parse(p.query);
}

Link.parse = function (text) {
  var links = {};

  if (text) {
    debug('parsing link header...');

    // Link headers look like this (comma separated):
    // <https://api.zotero.org/users/12345/items?limit=30&start=30>; rel="next"
    var pattern = /<([^>]+)>;\s*rel="([^"]+)"/g;
    var m;

    while ((m = pattern.exec(text)) !== null)
      links[m[2]] = new Link(m[1]);

  }

  return links;
};

reader(Link.prototype, 'url', function () {
  var query = qs.stringify(this.options);
  if (query.length) query = '?' + query;

  return this.path + query;
});

// --- Exports ---
exports = module.exports = Message;
exports.Link = Link;
