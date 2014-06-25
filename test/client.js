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
        message.should.not.have.property('res');
      });

      it('adds the message to the message queue and flushes it', function (done) {
        client.messages.should.be.empty;

        var message = client.get(path, function (_, m) {
          message.should.equal(m);
          client.messages.should.be.empty;

          done();
        });

        client.messages.should.not.be.empty;
        (!client.state.delayed).should.be.true;
      });

      it('message queue is flushed on the next tick', function (done) {
        client.messages.should.be.empty;

        client.get(path);

        client.messages.should.not.be.empty;

        process.nextTick(function () {
          client.messages.should.be.empty;
          done();
        });
      });

      it('calls back exactly once', function (done) {
        client.get(path, done);
      });

      describe('when the client is rate-limited', function () {

        beforeEach(function () {
          client.state.retry = 2000;
          client.state.timestamp = Date.now();
        });

        it('sets #state.delayed', function (done) {
          client.get(path);
          client.state.limited.should.be.greaterThan(0);
          (!client.state.delayed).should.be.true;

          process.nextTick(function () {
            (!client.state.delayed).should.be.false;
            clearTimeout(client.state.delayed);

            client.messages.should.not.be.empty;

            done();
          });
        });

        it('calls back exactly once', function (done) {
          client.state.retry = 15; // do not delay the test for too long!
          client.get(path, done);

          // the following assertion is just to make sure that
          // the queue is not flushed normally.
          client.state.limited.should.be.greaterThan(0);
        });

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

    it('updates client state using response headers', function (done) {
      var path = '/users/475425/collections/9KH9TNSJ/items';

      nock('https://api.zotero.org')
        .get(path)
        .reply(200, { foo: 23 }, { 'Retry-After': 42, 'Backoff': 11 });

      client.state.retry.should.eql(0);
      client.state.backoff.should.eql(0);

      client.get(path, function () {
        client.state.retry.should.eql(42000);
        client.state.backoff.should.eql(11000);
        done();
      });

      client.state.retry.should.eql(0);
      client.state.backoff.should.eql(0);
    });

  });

  describe('#state', function () {
    it('is not limited by default', function () {
      client.state.limited.should.eql(0);
      (!client.state.reason).should.be.true;
    });

    it('is limited if retry + now is in the future', function () {
      client.state.retry = 10000;
      client.state.timestamp = Date.now();
      client.state.limited.should.be.greaterThan(0);
      client.state.timestamp -= 10000;
      client.state.limited.should.eql(0);
    });
  });
});
