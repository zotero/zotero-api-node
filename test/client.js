var Client = require('../lib/client'),
  Message = require('../lib/message'),
  nock = require('nock'),
  sinon = require('sinon');

describe('Zotero.Client', function () {
  var client;

  beforeEach(function () { client = new Client(); });

  it('is a constructor', function () { Client.should.be.a.Function; });

  describe('#options', function () {
    it('has default values', function () {
      client.should.have.property('options');
      client.options.should.have.property('host', Client.defaults.host);
    });
  });

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
        client.get(path, function (error, message) {
          (!error).should.be.true;

          message.code.should.eql(200);
          message.data.toString().should.startWith(response);

          done();
        });
      });

      it('returns the (unsent) message object', function () {
        var message = client.get(path);

        message.should.be.instanceof(Message);
        message.should.have.property('req');
        message.should.have.property('res', undefined);
      });

      it('adds the message to the message queue and flushes it', function (done) {
        client.messages.should.be.empty;

        var message = client.get(path, function (_, m) {
          message.should.equal(m);
          client.messages.should.be.empty;

          done();
        });

        client.messages.should.not.be.empty;
      });
    });

    it('calls back with an error for non 2xx responses', function (done) {
      var path = '/there-is-no-spoon';

      nock('https://api.zotero.org')
        .get(path)
        .reply(404, 'Not found', { 'Content-Type': 'text/plain' });

      client.get(path, function (error, message) {
        error.code.should.eql(404);
        error.message.should.match(/not found/i);

        done();
      });
    });

    it('adds the passed-in options as a query to the path', function (done) {
      var path = '/users/475425/collections/9KH9TNSJ/items';

      nock('https://api.zotero.org')
        .get(path + '?format=versions')
        .reply(200, { foo: 23 });

      client.get(path, { format: 'versions' }, function (error, message) {
        (!error).should.be.true;

        message.code.should.eql(200);
        message.type.should.eql('json');

        message.data.should.be.an.Object;
        message.data.should.not.be.empty;
        message.data.foo.should.eql(23);

        done();
      });
    });

  });

  describe('#state', function () {
    it('is not limited by default', function () {
      client.state.limited.should.eql(0);
      (!client.state.reason).should.be.true;
    });
  });
});
