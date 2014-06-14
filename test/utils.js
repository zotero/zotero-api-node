var utils = require('../lib/utils');

describe('Zotero.utils', function () {

  describe('#downcase', function () {
    var downcase = utils.downcase;

    it('returns a new object with all keys converted to lower case', function () {
      downcase({}).should.be.empty;

      var x = { A: 1, b: 2 }, y = downcase(x);

      y.should.have.property('a', 1)
      y.should.have.property('b', 2)
      y.should.not.equal(x);

    });
  });

});
