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
function Message(client, req) {
  var self = this, res;

  debug('creating new message...');

  Readable.call(this);
  
  /**
   * @property client
   * @type Client
   */
  reader(this, 'client', client);

  /**
   * @property req
   * @type http.ClientRequest
   */
  property(this, 'req', {
    configurable: true,

    set: function (value) {
      req = value;

      // Update property to prohibit future writes
      reader(this, 'req', req);

      // Listen for response
      req.once('response', function (res) {
        debug('response received');
        self.res = res;
      });

      // Forward events
      req.on('response', this.emit.bind(this, 'response'));
      req.on('error', this.emit.bind(this, 'error'));
    }
  });

  /**
   * @property res
   * @type http.IncomingMessage
   */
  property(this, 'res', {
    configurable: true,

    set: function (value) {
      var data = [];
      var size = 0;

      res = value;
      reader(this, 'headers', downcase(res.headers));

      // Update property to prohibit future writes
      reader(this, 'res', res);

      // Setup data reception
      if (this.encoding) res.setEncoding(this.encoding);

      res.on('data', receiving);

      res.once('end', function () {
        debug('receiving message data complete: %d bytes read', size);

        res.removeListener('data', receiving);

        data = Buffer.concat(data, size);
        self.data = self.parse(data);

        reader(self, 'resolved', true);

        self.emit('received');
      });

      function receiving(chunk) {
        size += chunk.length;
        data.push(chunk);
        self.emit('data', chunk);
      }

      // forward other stream events
      res.on('readable', this.emit.bind(this, 'readable'));
      res.on('close', this.emit.bind(this, 'close'));
      res.on('error', this.emit.bind(this, 'error'));
    }
  });

  // Set request if it was provided
  if (req) this.req = req;
}

inherits(Message, Readable);


Object.defineProperties(Message.prototype, {

  encoding: {
    get: function () {
      if (!this.res) return undefined;
      return mime.charset(this.headers['content-type']);
    }
  },

  type: {
    get: function () {
      if (!this.res) return undefined;
      return mime.extension(this.headers['content-type']);
    }
  },

  code: {
    get: function () {
      return this.res && this.res.statusCode;
    }
  },

  ok: {
    get: function () { return this.code >= 200 && this.code < 300; }
  },

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
  // check if the message was sent?
  this.req.end();

  this.emit('sent', this);
  this.client.emit('sent', this);

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
  var descriptor = { configurable: false, writable: false };

  if (typeof value === 'function') {
    descriptor.get = value; 
  } else {
    descriptor.value = value;
  }

  property(obj, name, descriptor);
}

// --- Exports ---
exports = module.exports = Message;
