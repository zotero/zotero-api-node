var Message = require('../lib/message');

describe('Zotero.Message', function () {

  it('is a constructor', function () { Message.should.be.a.Function; });

  describe('#done', function () {
    it('is true by default', function () {
      (new Message()).done.should.be.true;
    });

    it('is false if there is a next link', function () {
      var m = new Message();

      m.links = {};
      m.done.should.be.true;

      m.links.next = {};
      m.done.should.be.false;
    });
  });
});
