var EventEmitter = require('events').EventEmitter;
var join = require('path').join;
var qs = require('querystring');
var url = require('url');

var debug = require('debug')('zotero');

var proxy = require('./proxy');
var utils = require('./utils');
var extend = utils.extend;


function Zotero(options) {
  this.options = extend({}, Zotero.defaults, options);

  this.proxy({
    items: {
      terminal: ['top', 'trash'],
      postfix: ['children', 'tags']
    }
  });
}



function property(name, definition) {
  return Object.defineProperty(Zotero.prototype, name, definition);
}

function reader(name, reader) {
  return property(name, { get: reader });
}

Zotero.prototype = new EventEmitter();


Zotero.defaults = {
  api: 'https://api.zotero.org',
  params: {},
  headers: {
    'Zotero-API-Version': '2',
    'User-Agent': 'zotero-node'
  }
};

Zotero.debug = function (error, response, body) {
  if (error) {
    debug('API error: %s', error);

  } else {
    debug('API response:\n%s\n', body);
  }
};


reader('prefix', function () {
  if (this.options.user != null) {
    return 'users/' + this.options.user;
  }

  if (this.options.group != null) {
    return 'groups/' + this.options.group;
  }

  return '';
});

property('api', {
  get: function () { return this.options.api; },
  set: function (api) { this.options.api = api; }
});

reader('base', function () {
  return join(this.api, this.prefix);
});


Zotero.prototype.proxy = function (options) {
  for (var name in options) {
    options[name] = {
      value: proxy(this, this.get, name, options[name])
    };
  }

  Object.defineProperties(this, options);

  return this;
};

Zotero.prototype.url = function (path, params) {
  return join(this.base, path) + this.stringify(params);
};

Zotero.prototype.stringify = function (params) {
  return qs.stringify(extend({}, this.options.params, params));
}


Zotero.prototype.get = function (path, params, callback) {
  if (typeof params === 'function') {
    callback = params; params = null;
  }

  //request({
  //  url: this.url(path, params),
  //  headers: this.defaults.headers

  //}, callback);

  return this;
};


function proxy(z, prefix, ext) {
  var i, ii, name;

  function p(path, params, cb) {
    return z.get(join(prefix, path), params, cb);
  };

  if (ext.terminal) {
    for (i = 0, ii = ext.terminal.length; i < ii; ++i) {
      name = ext.terminal[i];

      p[name] = function (params, cb) {
        return this(name, params, cb);
      };
    }
  }

  if (ext.postfix) {
    for (i = 0, ii = ext.postfix.length; i < ii; ++i) {
      name = ext.postfix[i];

      p[name] = function (prefix, params, cb) {
        return this(join(prefix, name), params, cb);
      };
    }
  }

  return p;
}

exports = module.exports = Zotero;
