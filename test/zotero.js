var Zotero = require('..'),
  sinon = require('sinon');

describe('Zotero', function () {
  it('is a constructor', function () { Zotero.should.be.a.Function; });
  it('has defaults', function () { Zotero.defaults.should.be.an.Object; });

  describe('instance', function () {
    var z;

    beforeEach(function () { z = new Zotero(); });

    it('has no prefix by default', function () {
      z.prefix.should.eql('');
    });

    it('has a prefix if user or group id is present', function () {
      z.options.user = '23';
      z.prefix.should.eql('users/23')
      z.options.group = '42';
      z.prefix.should.eql('users/23')
      delete z.options.user;
      z.prefix.should.eql('groups/42')
    });

  });
});
