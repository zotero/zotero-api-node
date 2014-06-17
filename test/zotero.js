var zotero = require('..'),
  sinon = require('sinon');

describe('zotero', function () {
  it('is a function', function () { zotero.should.be.a.Function; });

  it('.Client is defined', function () {
    zotero.Client.should.be.a.Function;
  });
});
