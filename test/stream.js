'use strict';

var EventEmitter = require('events').EventEmitter;

var Stream = require('../lib/stream');
var Client = require('../lib/client');

describe('Zotero.Stream', function () {

  it('is a constructor', function () { Stream.should.be.a.Function; });

  describe('given a simple single-key stream', function () {

    it('creates a websocket instance', function () {
      (new Stream({ key: 'abc123' })).should.have.property('ws');
    });

    it('inherits from Client and EventEmitter', function () {
      var s = new Stream({ key: 'abc123' });

      s.should.be.instanceof(Client);
      s.should.be.instanceof(EventEmitter);
    });

    it('sends the api key as a header', function () {
    });

    it('listeners can be added', function (done) {
      var s = new Stream({ key: 'abc123' });
      var called = 0;

      s.on('topicAdded', function () { ++called; });

      // Error called when stream terminates!
      s.on('error', function () {
        called.should.eql(2);
        done();
      });
    });

    it('listeners can be removed', function (done) {
      var s = new Stream({ key: 'abc123' });
      var called = 0;

      function listener() {
        s.removeListener('topicAdded', listener);
        called++;
      }

      s.on('topicAdded', listener);

      // Error called when stream terminates!
      s.on('error', function () {
        called.should.eql(1);
        done();
      });
    });
  });

  describe('given a simple multi-key stream', function () {

    it('creates an event source instance', function () {
      (new Stream()).should.have.property('ws');
    });

    it('listeners can be added', function (done) {
      var s = new Stream();
      var called = 0;

      s.on('topicUpdated', function () { ++called; });

      // Error called when stream terminates!
      s.on('error', function () {
        called.should.eql(2);
        done();
      });
    });

    it('listeners can be removed', function (done) {
      var s = new Stream();
      var called = 0;

      function listener() {
        s.removeListener('topicUpdated', listener);
        called++;
      }

      s.on('topicUpdated', listener);

      // Error called when stream terminates!
      s.on('error', function () {
        called.should.eql(1);
        done();
      });
    });

    describe('#subscribe', function () {
      it('sends a subscribe message', function (done) {

        (new Stream())
          .once('connected', function () {

            this.subscribe({ apiKey: 'foo' }, function (error) {
              (!error).should.be.true;

              done();
            });
          });
      });
    });

    describe('#unsubscribe', function () {
      it('sends an unsubscribe message', function (done) {

        (new Stream())
          .once('connected', function () {

            this.unsubscribe({ apiKey: 'foo' }, function (error, message) {
              (!error).should.be.true;

              message.code.should.eql(204);

              done();
            });
          });
      });
    });
  });
});
