var Library = require('../lib/library'),
  Client = require('../lib/client'),
  sinon = require('sinon');

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

      ulib.id.should.eql(42);
      glib.id.should.eql(5);

      ulib.type.should.eql('user');
      glib.type.should.eql('group');
    });
  });

  describe('#client', function () {
    it('returns a Zotero.Client instance', function () {
      library.client.should.be.an.instanceof(Client);
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

  describe('#items', function () {
    beforeEach(function () { sinon.stub(library, 'get'); });
    afterEach(function () { library.get.restore(); });

    it('is a function', function () { library.items.should.be.a.Function; });

    it('cannot be removed', function () {
      library.items = null;
      library.items.should.be.a.Function;
    });

    it('calls #get with items/:id', function () {
      library.items('foo');
      library.get.called.should.be.true;
      library.get.args[0][0].should.eql('items/foo');
    });

    describe('#top', function () {
      it('is a function', function () { library.items.top.should.be.a.Function; });

      it('calls #get with items/top', function () {
        library.items.top();
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/top');

        library.items.top({ foo: 'bar' });
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });
    });

    describe('#trash', function () {
      it('is a function', function () { library.items.trash.should.be.a.Function; });

      it('calls #get with items/top', function () {
        library.items.trash();
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/trash');
      });
    });

    describe('#children', function () {
      it('is a function', function () { library.items.children.should.be.a.Function; });

      it('calls #get with items/:id/children', function () {
        library.items.children(42);
        library.get.called.should.be.true;
        library.get.args[0][0].should.eql('items/42/children');

        library.items.children('foo', { foo: 'bar' });
        library.get.args[1][0].should.eql('items/foo/children');
        library.get.args[1][1].should.have.properties({ foo: 'bar' });
      });
    });
  });
});

