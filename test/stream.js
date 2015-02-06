'use strict';

var EventEmitter = require('events').EventEmitter;

var Stream = require('../lib/stream');
var Client = require('../lib/client');
var nock = require('nock');
var EventSource = require('eventsource');

describe('Zotero.Stream', function () {

  it('is a constructor', function () { Stream.should.be.a.Function; });

  describe('given a simple single-key stream', function () {
    beforeEach(function () {
      nock('https://stream.zotero.org')
        .get('/?apiKey=abc123')
        .reply(
          200,

          'retry: 1000\n\n' +
          'event: connected\n' +
          'data: {"topics":["foobar"]}\n\n' +
          'event: topicAdded\n' +
          'data: {"topic":"foo","version":23}\n\n' +
          'event: topicAdded\n' +
          'data: {"topic":"foo","version":24}\n\n',

          {
            'Content-Type': 'text/event-stream'
          }
        );
    });

    it('creates an event source instance', function () {
      (new Stream({ key: 'abc123' })).eventsource.should.be.instanceof(EventSource);
    });

    it('inherits from Client and EventEmitter', function () {
      var s = new Stream({ key: 'abc123' });

      s.should.be.instanceof(Client);
      s.should.be.instanceof(EventEmitter);
    });


    it('does not set the connection id', function (done) {
      (new Stream({ key: 'abc123' })).on('connected', function () {
        this.should.be.instanceof(Stream);
        (this.connection === undefined).should.be.true;

        done();
      });
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
    beforeEach(function () {
      nock('https://stream.zotero.org')
        .get('/')
        .reply(
          200,

          'retry: 1000\n\n' +
          'event: connected\n' +
          'data: {"connectionId":"foobar"}\n\n' +
          'event: topicUpdated\n' +
          'data: {"topic":"foo","version":23}\n\n' +
          'event: topicUpdated\n' +
          'data: {"topic":"bar","version":24}\n\n',

          {
            'Content-Type': 'text/event-stream'
          }
        );
    });

    it('creates an event source instance', function () {
      (new Stream()).eventsource.should.be.instanceof(EventSource);
    });

    it('sets the connection id', function (done) {
      (new Stream()).on('connected', function () {
        this.should.be.instanceof(Stream);
        this.connection.should.eql('foobar');

        done();
      });
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
      it('sends a subscribe POST request', function (done) {

        nock('https://stream.zotero.org')
          .post('/connections/foobar', {
            subscriptions: [
              { apiKey: 'foo' }
            ]
          })
          .reply(201);

        (new Stream())
          .once('connected', function () {

            this.subscribe({ apiKey: 'foo' }, function (error, message) {
              (!error).should.be.true;

              message.code.should.eql(201);

              done();
            });
          });
      });
    });

    describe('#unsubscribe', function () {
      it('sends an unsubscribe DELETE request', function (done) {

        nock('https://stream.zotero.org')
          .delete('/connections/foobar', { apiKey: 'foo' })
          .reply(204);

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
