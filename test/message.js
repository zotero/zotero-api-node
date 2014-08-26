var sinon = require('sinon');
var nock = require('nock');
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

  describe('#send', function () {
    var m;

    beforeEach(function () { m = new Message(); });

    it('fails if the message has not been bound', function () {
      (m.send.bind(m)).should.throw();
    });

    it('does not do anything if it has already been sent', function () {
      m.sent = true;
      m.send().should.equal(m);
    });

    it('calls `end` on the http request', function () {
      m.req = { end: sinon.spy() };
      m.send();
      m.req.end.called.should.be.true;
    });

    describe('when a request is bound', function () {
      beforeEach(function () {
        nock('https://api.zotero.org')
          .get('/users/42/items')
          .reply(200, 'ok');

        m.bind({
          host: 'api.zotero.org',
          path: '/users/42/items'
        });
      });

      it('sends the request', function (done) {
        m.on('sent', function () {
          m.sent.should.be.true;
          done();
        });

        m.send();
      });

      it('parses the response when it comes', function (done) {
        m.on('received', function () {
          m.sent.should.be.true;
          m.received.should.be.true;

          m.code.should.eql(200);
          m.data.should.eql('ok');
          m.ok.should.be.true;

          done();
        });

        m.send();
      });
    });
  });
});
