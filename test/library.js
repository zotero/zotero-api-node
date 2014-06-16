var Library = require('../lib/library'),
  Client = require('../lib/client');

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
});

