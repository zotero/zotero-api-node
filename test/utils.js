var utils = require('../lib/utils');

describe('Zotero.utils', function () {

  describe('#downcase', function () {
    var downcase = utils.downcase;

    it('returns a new object', function () {
      var x = { foo: 'bar' };
      downcase(x).should.not.equal(x);
    });

    it('converts all keys to lower case', function () {
      downcase({}).should.be.empty;
      downcase({ FOo: 1 }).should.have.property('foo', 1);
      downcase({ foo: 1 }).should.have.property('foo', 1);
      downcase({ Foo: 1, Bar: 2 }).should.have.properties('foo', 'bar');
    });
  });

});
