'use strict';

var sinon = require('sinon');

var EventEmitter = require('events').EventEmitter;

var Stream = require('../lib/stream');
var Client = require('../lib/client');

var Subscriptions = Stream.Subscriptions;

describe('Zotero.Stream', function () {

  before(function () {
    // Stub the open method to create a simple
    // EventEmitter instead of a WebSocket!
    sinon.stub(Stream.prototype, 'open', function () {
      this.socket = new EventEmitter();
      this.bind();
      return this;
    });
  });

  it('is a constructor', function () { Stream.should.be.a.Function; });

  describe('given a simple single-key stream', function () {
    var s;

    beforeEach(function () { s = new Stream({ key: 'abc123' }); });

    it('creates a websocket instance', function () {
      s.should.have.property('socket');
    });

    it('inherits from Client and EventEmitter', function () {
      s.should.be.instanceof(Client);
      s.should.be.instanceof(EventEmitter);
    });

    it('is not a multi-key stream', function () {
      s.should.have.property('multi', false);
    });

    it('sets the API key header', function () {
      s.options
        .should.have.property('headers')
        .and.have.property('Zotero-API-Key', 'abc123');
    });

    describe('on connected', function () {
      var message = {
        event: 'connected',
        retry: 333,
        topics: ['/users/123456', '/groups/234567']
      };

      var cb = sinon.spy();

      beforeEach(function () {
        s.on('connected', cb);

        s.socket.emit('open');
        s.socket.emit('message', JSON.stringify(message));
      });

      it('adds the topics to the subscription list', function () {
        s.subscriptions.topics.should.eql(message.topics);
      });

      it('updates the retry value', function () {
        s.retry.delay.should.eql(message.retry);
      });

      it('emits the connected event', function () {
        cb.called.should.be.true;
      });
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

        s.update([{ apiKey: 'x' }]);

        s.all.should.have.length(2);
        s.topics.should.eql(['foo']);
      });
    });

    describe('.cancel', function () {
      beforeEach(function () {
        s.update([ { topics: ['foo'] }, { apiKey: 'x', topics: ['bar', 'baz'] } ]);
      });

      it('cancels all subscriptions for a given key', function () {
        s.cancel([{ apiKey: 'x' }]);

        s.all.should.have.length(1);
        s.topics.should.eql(['foo']);
      });

      it('cancels specific key/topic pair', function () {
        s.cancel([{ apiKey: 'x', topic: 'baz' }]);

        s.all.should.have.length(2);
        s.topics.should.eql(['foo', 'bar']);
      });

      it('cancels public topic', function () {
        s.cancel([{ topic: 'foo' }]);

        s.all.should.have.length(2);
        s.topics.should.eql(['bar', 'baz']);
      });

      it('does not fail on non-existent keys/topics', function () {
        s.cancel.bind(s, [{ apiKey: 'y' }]).should.not.throw();
        s.cancel.bind(s, [{ apiKey: 'y', topic: 'qux' }]).should.not.throw();
        s.cancel.bind(s, [{ topic: 'qux' }]).should.not.throw();

        s.all.should.have.length(2);
        s.topics.should.eql(['foo', 'bar', 'baz']);
      });
    });

    describe('.add', function () {
      beforeEach(function () {
        s.update([ { topics: ['foo'] }, { apiKey: 'x' } ]);
      });

      it('adds a topic to an existing subscription', function () {
        s.add({ topic: 'bar' });

        s.topics.should.eql(['foo', 'bar']);
        s.get().topics.should.eql(['foo', 'bar']);

        s.add({ topic: 'baz', apiKey: 'x' });

        s.topics.should.eql(['foo', 'bar', 'baz']);
        s.get().topics.should.eql(['foo', 'bar']);
        s.get('x').topics.should.eql(['baz']);
      });

      it('fails if subscription does not exist', function () {
        s.add.bind(s, [{ topic: 'baz', apiKey: 'y' }]).should.throw();
      });
    });

    describe('.remove', function () {
      beforeEach(function () {
        s.update([ { topics: ['foo'] }, { apiKey: 'x' } ]);
      });

      it('removes a single topic from existing subscriptions', function () {
        s.remove({ topic: 'foo' });

        s.all.should.have.length(2);
        s.topics.should.be.empty;
      });

      it('does not fail if subscription does not exist', function () {
        s.remove.bind(s, { topic: 'baz', apiKey: 'y' }).should.not.throw();
      });

      it('does not fails if the topic was not part of the subscription', function () {
        s.remove.bind(s, { topic: 'baz' }).should.not.throw();
      });
    });
  });
});
