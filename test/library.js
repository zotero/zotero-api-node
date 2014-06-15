var Library = require('../lib/library');

describe('Zotero.Library', function () {
  var library;

  beforeEach(function () { library = new Library(); });

  it('is a constructor', function () { Library.should.be.a.Function; });

});

