Zotero-Node
===========
[![Build Status](https://travis-ci.org/inukshuk/zotero-node.svg?branch=master)](https://travis-ci.org/inukshuk/zotero-node)
[![Coverage Status](https://img.shields.io/coveralls/inukshuk/zotero-node.svg)](https://coveralls.io/r/inukshuk/zotero-node?branch=master)

A Zotero API client package for Node.js. This package tries to make it
as easy as possible to bootstrap a Zotero client application in Node.js;
it comes with hardly any runtime dependencies and provides three simple
abstractions to interact with Zotero: `Client`, `Library`, and `Message`.

Clients handle the HTTPS connection to a Zotero data server, observing
any rate-limiting directives issued by the server; you can configure
settings (like API versions, default headers etc.) for each Client.
Each Library represents a Zotero user or group library and is associated
with a Client instance; a Library offers many convenience methods to
make it easy to construct Zotero API requests. Each request and the
corresponding response are then encapsulated in a Message instance, wich
provides accessors and an extendable body parser collection to handle
the various formats supported by Zotero.

Quickstart
----------
Install the NPM package:

    $ npm install zotero

And:

    var zotero = require('zotero');

Now you can use the `zotero.Client` and `zotero.Library` constructors;
the latter is also aliased to the `zotero` namespace. Let's access the
Library of Zotero's public user:

    var lib = zotero({ user: '475425' });

When creating a Library you can pass-in a Client instance using the
`client` property; if you don't, a default Client will be created for
you. You can access the client through the library:

    > // The default HTTP headers used by the client
    > lib.client.options.headers;
    { 'Zotero-API-Version': '3', 'User-Agent': 'zotero-node/0.0.1' }

    > // Let's make the client re-use the TCP connection to the server
    > lib.client.persist = true;
    > lib.client.options.headers['Connection'];
    'keep-alive'

To send requests to Zotero you can now use `Library#get(path, options, callback)`,
or use the convenience methods baked into Zotero-Node:

    > lib.items();
    // Will call /users/475425/items

    > lib.items.top({ limit: 3 })
    // Will call /users/475425/items/top?limit=3

    > lib.items('KWENT2ZM', { format: 'csljson' });
    // Will call /users/475425/items/KWENT2ZM?format=csljson

And so on; all valid Zotero API paths can be created this way (but you can also
use the `#get` method with any path yourself). All of these path methods allow
you to pass options which will be added as URL parameters. The methods will return
a Message instance; at that moment, the Message will only contain the HTTP request
which has not been sent yet, allowing you to make alterations, set event handlers
and so on. You can also pass a callback function to the request methods, which will
receive the Message instance when the response has been received and parsed.

If you just want to quickly print information about a message, pass-in
`zotero.print` as the callback. It will print out information like this:

    > lib.items('KWENT2ZM', { format: 'csljson' }, zotero.print);

    zotero:node Path:     /users/475425/items/KWENT2ZM?format=csljson +0ms
    zotero:node Status:   200 +2ms
    zotero:node Type:     json +1ms
    zotero:node Headers:  {"date":"Thu, 26 Jun 2014 10:36:07 GMT","server":"Apache/2.2.15 (CentOS)","zotero-api-version":"2","content-length":"148","connection":"close","content-type":"application/vnd.citationstyles.csl+json"} +0ms
    zotero:node Content:  {"items":[{"id":"392648/KWENT2ZM","type":"webpage","title":"Zotero | Home","URL":"http://staging.zotero.net/","accessed":{"raw":"2011-06-28"}}]} +0ms

Message Parsing
---------------
Zotero-Node was written with the Zotero API v3 in mind and, by default, will parse
JSON responses automatically. Contents are accessible in the `message.data` property
once the response has been received. Other content-types will be saved as strings
using the appropriate encoding. Having said that, it is very easy to add your own message
parsers to Zotero-Node, by adding them to `zotero.Messages.parsers`. For instance,
we could add a parser for Atom responses like this:


    var zotero = require('zotero');
    var xml2js = require('xml2js').parseString;

    zotero.Message.parsers.atom = function (data, callback) {
      return xml2js(data.toString(this.encoding), callback);
    };

Now, if you make a call that returns an Atom feed, it will be parsed automatically:

    lib.items.top({ format: 'atom', limit: 2 }, function (error, message) {
      if (error) return console.log(error.message);
      console.dir(message.data.feed);
    });

Stream API
----------
Zotero-Node supports the Zotero Stream API through zotero.Stream. To create
a single key stream, simply pass your Zotero API key to the constructor:

    var stream = new zotero.Stream({ key: 'your-zotero-api-key' });

You can then register handlers for all events:

    stream.on('topicUpdated', function (evt) {
      console.log(evt.data.topic);
      console.log(evt.data.version);
    });

If you create a stream without a key, it will default to a multi key
stream. Once the stream has been established, you can manage your
subscriptions using the `.subscribe` and `.unsubscribe` methods.

    (new zotero.Stream())
      .on('connected', function () {
        this.subscribe([
          { apiKey: 'abc123' },
          { apiKey: 'efd456', topics: [ '/users/12345' ] }
        ]);
      });

You can also create a multi-key stream for a given Zotero user or group
library, by using the `.stream` method on the library instance. This will
automatically create the stream and subscribe to the current library,
using the library's API key (if present):

    zotero({ user: '475425' })
      .stream(function (error, stream) {

        // This will set up a stream and subscribe to
        // the topic '/users/475425'. The callback will
        // be called once the subscription has been
        // accepted (or if there was an error).

      });

Rate-Limiting
-------------
Zotero-Node observes rate-limit directives by default, so you should not have
to worry about them. The headers of each response are parsed by the client; if
there are any `Retry-After` or `Backoff` headers, the client will switch into
limited mode; all messages you send in limited mode, will be held back, until
the limited period has expired.

If you want to check the client's state, you can do so by calling
`client.state.limited` – this will return the time until the limited period
will be expired; if `limited` is zero, the client is in normal mode.

If you want to force the client to send messages in limited mode, you can do
so by calling `client.flush(true)` with the force flag set to true.

What about promises?
--------------------
Zotero-Node uses standard Node.js style callbacks out of the box, but you can
easily promisify the API. Simply call `zotero.promisify` passing in the Promise
implementation's promisify variant of your choice.

    // For Bluebird:
    zotero.promisify(Promise.promisify.bind(Promise));

    // For Q:
    zotero.promisify(Q.denodeify.bind(Q));

This will promisify the Client's request method; as a result `Client#get` and
all Library getters will return a Promise instead of a Message object. If you
want to access the message object before it is sent, you can still do so: all
messages are stored in `client.messages` before they are sent; messages are
added at the start of the list, so your last message will always be at index
zero in the queue.

    // Using Bluebird promises, fetch the top 5 items of a library:
    var promise = lib.items.top({ limit: 5 });

    // If you need to modify the message before it is sent, you
    // can access it at the start of the client's message queue.
    lib.client.messages[0].req.getHeader('Zotero-API-Version');

    // Handle the API response or errors when the promise is
    // resolved or rejected:
    promise
      .then(function (message) {
        // Handle the Zotero API response...
      })
      .catch(function (error) {
        // Handle any errors...
      });

Note that the Stream API also uses promieses now:

    lib
      .stream()
      .then(function (stream) {
        // ...
      });

You can undo the promisification at any time by calling:

    zotero.promisify.restore();



License
-------
Copyright 2014 Sylvester Keil. All rights reserved.

Zotero-Node is licensed under the AGPL3 license. See LICENSE for details.
