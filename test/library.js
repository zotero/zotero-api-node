'use strict';

var sinon = require('sinon');

var Library = require('../lib/library');
var Client  = require('../lib/client');
//var Stream  = require('../lib/stream');

describe('Zotero.Library', function () {
  var library;

  beforeEach(function () { library = new Library(); });

  it('is a constructor', function () { Library.should.be.a.Function; });

  describe('constructor', function () {
    it('re-uses passed-in client instance', function () {
      var c = new Client();
      (new Library({ client: c })).client.should.equal(c);
    });

    it('uses passed-in user/group id', function () {
      var ulib = new Library({ user: 42 });
      var glib = new Library({ group: 5 });

      (library.id === undefined).should.be.true;
      ulib.id.should.eql(42);
      glib.id.should.eql(5);

      (library.type === undefined).should.be.true;
      ulib.type.should.eql('user');
      glib.type.should.eql('group');
    });

    it('uses passed-in headers to set default headers', function () {
      (new Library({ headers: { qux: 'quux' } }))
        .headers.should.have.property('qux', 'quux');
    });
  });

  describe('#client', function () {
    it('returns a Zotero.Client instance', function () {
      library.client.should.be.an.instanceof(Client);
    });
  });

  describe('#get', function () {
    beforeEach(function () { sinon.stub(library.client, 'get'); });
    afterEach(function () { library.client.get.restore(); });

    it('passes along library headers', function () {
      library.get('foo');

      library.client.get.called.should.be.true;
      library.client.get.args[0][2].should.be.empty;

      library.headers.bar = 'baz';

      library.get('foo');
      library.client.get.args[1][2].should.have.property('bar', 'baz');
    });

    it('it includes the API key in the header by default', function () {
      library.key = 'foo';
      library.get('foo');

      library.client.get.called.should.be.true;
      library.client.get.args[0][2]
        .should.have.property('Authorization', 'Bearer foo');
    });

    it('it includes the API key as a parameter for version 2', function () {
      library.client.version = 2;
      library.key = 'foo';

      library.get('foo');

      library.client.get.called.should.be.true;
      library.client.get.args[0][2].should.be.empty;
      library.client.get.args[0][1].should.have.property('key', 'foo');
    });
  });

  describe('#prefix', function () {
    it('is empty if the library has no id', function () {
      library.prefix.should.be.empty;
    });

    it('return users/:id for user libraries', function () {
      library.user = 42;
      library.prefix.should.eql('users/42');
    });

    it('return groups/:id for group libraries', function () {
      library.group = 23;
      library.prefix.should.eql('groups/23');
    });
  });

  describe('#path', function () {
    it('returns / if the library has no id', function () {
      library.path().should.eql('/');
      library.path('foo').should.eql('/foo');
    });

    it('returns /:prefix if the library has an id', function () {
      library.user = 42;
      library.path().should.eql('/users/42');
      library.path('foo').should.eql('/users/42/foo');
    });
  });

  describe('#items', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () { library.items.should.be.a.Function; });

    it('calls #get with items/:id', function () {
      library.items('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('items/foo');
    });

    describe('#top', function () {
      it('is a function', function () {
        library.items.top.should.be.a.Function;
      });

      it('calls #get with items/top', function () {
        library.items.top();
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/top');

        library.items.top({ foo: 'bar' });
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });
    });

    describe('#trash', function () {
      it('is a function', function () {
        library.items.trash.should.be.a.Function;
      });

      it('calls #get with items/trash', function () {
        library.items.trash();
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/trash');
      });
    });

    describe('#children', function () {
      it('is a function', function () {
        library.items.children.should.be.a.Function;
      });

      it('calls #get with items/:id/children', function () {
        library.items.children(42);
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/42/children');

        library.items.children('foo', { foo: 'bar' });
        library.get.args[1][0].should.eql('items/foo/children');
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });
    });

    describe('#tags', function () {
      it('is a function', function () {
        library.items.tags.should.be.a.Function;
      });

      it('calls #get with items/:id/tags', function () {
        library.items.tags(42);
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/42/tags');

        library.items.tags('foo', { foo: 'bar' });
        library.get.args[1][0].should.eql('items/foo/tags');
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });
    });
  });

  describe('#collections', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () {
      library.collections.should.be.a.Function;
    });

    it('calls #get with collections/:id', function () {
      library.collections();
      library.collections('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('collections');
      library.get.args[1][0].should.eql('collections/foo');
    });

    describe('#collections', function () {
      it('is a function', function () {
        library.collections.collections.should.be.a.Function;
        library.collections.nested.should.be.a.Function;
      });

      it('calls #get with collections/:id/collections', function () {
        library.collections.collections('bar');
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('collections/bar/collections');
      });

      it('is also aviable as #nested', function () {
        library.collections.nested('bar');
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('collections/bar/collections');
      });
    });

    describe('#tags', function () {
      it('is a function', function () {
        library.collections.tags.should.be.a.Function;
      });

      it('calls #get with collections/:id/tags', function () {
        library.collections.tags(42);
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('collections/42/tags');
      });
    });

    describe('#items', function () {
      it('is a function', function () {
        library.collections.items.should.be.a.Function;
      });

      it('calls #get with collections/:id/items', function () {
        library.collections.items(5);
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('collections/5/items');

        library.collections.items('23', { foo: 'bar' });
        library.get.args[1][0].should.eql('collections/23/items');
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });

      describe('#top', function () {
        it('is a function', function () {
          library.collections.items.top.should.be.a.Function;
        });

        it('calls #get with collections/:id/items/top', function () {
          library.collections.items.top(5);
          library.get.called.should.be.true;
          library.get.args[0][0].should.eql('collections/5/items/top');

          library.collections.items.top('23', { foo: 'bar' });
          library.get.args[1][0].should.eql('collections/23/items/top');
          library.get.args[1][1].should.have.properties({ foo: 'bar' });
        });
      });
    });
  });

  describe('#tags', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () { library.tags.should.be.a.Function; });

    it('calls #get with tags/:tag', function () {
      library.tags();
      library.tags('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('tags');
      library.get.args[1][0].should.eql('tags/foo');
    });

    it('url-encodes the tag', function () {
      library.tags('foo bar/baz');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('tags/foo%20bar%2Fbaz');
    });
  });

  describe('#keys', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () { library.keys.should.be.a.Function; });

    it('calls #get with keys/:key', function () {
      library.keys();
      library.keys('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('keys');
      library.get.args[1][0].should.eql('keys/foo');
    });
  });

  describe('#searches', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () { library.searches.should.be.a.Function; });

    it('calls #get with searches/:key', function () {
      library.searches();
      library.searches('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('searches');
      library.get.args[1][0].should.eql('searches/foo');
    });
  });

  describe('#stream', function () {

    describe('when the event stream works', function () {
      beforeEach(function () {
        library.user = 12345;
      });

      it('connects to the stream API');

      it('adds a subscription for the library');

      it('uses the library API key if present');

      it('fails if the subscription request fails');
    });

    describe('when the event stream does not work', function () {
      beforeEach(function () {
        library.user = 12345;
      });

      it('calls back with an error', function () {
        //library.stream(function (error) {
        //  (!error).should.be.false;
        //  done();
        //});
      });
    });

  });
});
