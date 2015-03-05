'use strict';

var sinon = require('sinon');

var EventEmitter = require('events').EventEmitter;

var Stream = require('../lib/stream');
var Client = require('../lib/client');

var Subscriptions = Stream.Subscriptions;

describe('Zotero.Stream', function () {

  before(function () {
    sinon.stub(Stream.prototype, 'open', function () {
      this.socket = sinon.stub();
      return this;
    });
  });

  it('is a constructor', function () { Stream.should.be.a.Function; });

  describe('given a simple single-key stream', function () {

    it('creates a websocket instance', function () {
      (new Stream({ key: 'abc123' })).should.have.property('socket');
    });

    it('inherits from Client and EventEmitter', function () {
      var s = new Stream({ key: 'abc123' });

      s.should.be.instanceof(Client);
      s.should.be.instanceof(EventEmitter);
    });

    it('is not a multi-key stream', function () {
      (new Stream({ key: 'abc123' })).should.have.property('multi', false);
    });

    it('sets the API key header', function () {
      (new Stream({ key: 'abc123' }).options)
        .should.have.property('headers')
        .and.have.property('Zotero-API-Key', 'abc123');
    });
  });

  describe('given a simple multi-key stream', function () {

    it('creates a websocket instance', function () {
      (new Stream()).should.have.property('socket');
    });

    it('is a multi-key stream', function () {
      (new Stream()).should.have.property('multi', true);
    });

    it('does not set the API key header', function () {
      (new Stream().options)
        .should.have.property('headers')
        .and.not.have.property('Zotero-API-Key');
    });

  });
});

describe('Zotero.Stream.Subscriptions', function () {

  it('is a constructor', function () { Subscriptions.should.be.a.Function; });

  describe('instance', function () {
    var s;

    beforeEach(function () { s = new Subscriptions(); });

    it('has an array of all subscriptions', function () {
      s.should.have.property('all', []);
    });

    it('has an array of all topics', function () {
      s.should.have.property('topics', []);
    });

    describe('.update', function () {
      it('adds new subscriptions', function () {
        s.update([
          { apiKey: 'foo', topics: ['foo', 'bar'] },
          { topics: ['baz'] },
          { apiKey: 'qux' }
        ]);

        s.all.should.have.length(3);
        s.topics.should.eql(['foo', 'bar', 'baz']);
      });

      it('updates existing subscriptions', function () {
        s.update([{ topics: ['foo', 'bar'] }]);
        s.update([{ topics: ['foo' ] }]);

        s.all.should.have.length(1);
        s.topics.should.eql(['foo']);

        s.update([{ apiKey: 'x' }]);

        s.all.should.have.length(2);
        s.topics.should.eql(['foo']);

        s.update([{ apiKey: 'x', topics: ['bar'] }]);

        s.all.should.have.length(2);
        s.topics.should.eql(['foo', 'bar']);
      });
    });

    describe('.remove', function () {
    });
  });
});
