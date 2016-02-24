// # Zotero-Node
//
// Zotero-Node is a light-weight Node.js library for accessing the
// Zotero API. Its goal is to handle URL construction, parameter
// management and response body parsing using primarily the Node
// standard library, to make it easy to bootstrap Zotero client
// applications.
//
// To start using Zotero-Node, install it using NPM:
//
//     $ npm install zotero
//
// The module exposes a `Library` and a `Client` class; the former
// represents either a user or group library, the latter handles
// the network connection between Zotero-Node and the API servers.
//

var zotero = require('..');
var assert = require('assert');

// `zotero.defaults` holds the default configuration that will be
// used to connect to the Zotero API. This configuration is copied
// to each client instance so you can also make changes for each
// client individually.
//
// By using the `zotero.Client` constructor we can create a new
// client instance. Normally, we will not need to do that, because
// a default client will come with each `zotero.Library`; to create
// a library we can also use the main module as a shorthand:

var library = zotero({ user: '475425' });
var client = library.client;

assert(library instanceof zotero.Library);
assert(client instanceof zotero.Client);

library.items(zotero.print);
