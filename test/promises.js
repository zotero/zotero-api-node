var zotero = require('..'),
  nock = require('nock'),
  Promise = require('bluebird'),
  sinon = require('sinon');

describe('When using Promises', function () {
  before(function () {
    zotero.promisify(Promise.promisify);
  });

  after(function () { zotero.promisify.restore(); });

  describe('Zotero.Client', function () {
    var client;

    beforeEach(function () { client = new zotero.Client(); });

    describe('#get', function () {
      describe('given a valid path', function () {
        var path = '/users/475425/collections/9KH9TNSJ/items';
        var response = '<?xml version="1.0"';

        beforeEach(function() {
          nock('https://api.zotero.org')
            .get(path)
            .reply(200, response);
        });

        it('sends an HTTPS request to the API server', function (done) {
          client.get(path).then(function (message) {
            message.code.should.eql(200);
            message.data.toString().should.startWith(response);
            done();
          });
        });

        it('returns the a promise object', function () {
          client.get(path).should.be.instanceof(Promise);
        });

        it('adds the message to the message queue and flushes it', function (done) {
          client.messages.should.be.empty;

          client.get(path).then(function () {
            client.messages.should.be.empty;
            done();
          });

          client.messages.should.not.be.empty;
        });
      });

      it('rejects the promise with an error for non 2xx responses', function (done) {
        var path = '/there-is-no-spoon';

        nock('https://api.zotero.org')
          .get(path)
          .reply(404, 'Not found', { 'Content-Type': 'text/plain' });

        client.get(path).catch(function (error) {
          error.cause.code.should.eql(404);
          error.cause.message.should.match(/not found/i);
          done();
        });
      });
    });
  });
});

