var zotero = require('..');
//var sinon = require('sinon');

describe('zotero', function () {
  it('is a function', function () { zotero.should.be.a.Function; });

  it('.Client is defined', function () {
    zotero.Client.should.be.a.Function;
  });

  it('.Library is defined', function () {
    zotero.Library.should.be.a.Function;
  });

  it('calling it returns a library instance', function () {
    zotero().should.be.instanceof(zotero.Library);
  });

  describe('.print', function () {
    it('is a function', function () { zotero.print.should.be.a.Function; });

    /* This currently fails on Travis-CI

    it('can be called with error and message parameters', function () {
      sinon.stub(console, 'log');
      zotero.print(sinon.stub({}), sinon.stub({ code: 42 }));
      console.log.called.should.be.true;
      console.log.restore();
    });

    */
  });

});
