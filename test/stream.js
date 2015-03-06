/*eslint max-nested-callbacks:0 */

'use strict';

var sinon = require('sinon');

var EventEmitter = require('events').EventEmitter;
var WS = require('ws');

var Stream = require('../lib/stream');
var Client = require('../lib/client');

var Subscriptions = Stream.Subscriptions;

var F = require('./fixtures.json').stream;

describe('Zotero.Stream', function () {

  // Stub the open method to create a simple
  // EventEmitter instead of a WebSocket!
  before(function () {
    sinon.stub(Stream.prototype, 'open', function () {
      this.socket = new EventEmitter();
      this.bind();

      this.socket.send = sinon.stub().yields();
      this.socket.close = sinon.spy(function (code) {
        this.readyState = WS.CLOSED;
        this.emit('close', code);
      });

      this.socket.readyState = WS.OPEN;
      this.socket.emit('open');

      return this;
    });
  });

  after(function () { Stream.prototype.open.restore(); });

  it('is a constructor', function () { Stream.should.be.a.Function; });

  describe('given an open stream', function () {
    var stream;

    beforeEach(function () {
      stream = new Stream();

      sinon.spy(stream, 'emit');
    });

    describe('.close()', function () {
      it('closes the socket', function () {
        var socket = stream.socket;

        socket.close.called.should.be.false;
        stream.close();
        socket.close.called.should.be.true;
      });

      it('deletes the socket', function () {
        stream.close();
        stream.should.not.have.property('socket');
      });

      it('emits the close event', function () {
        stream.close();
        stream.emit.called.should.be.true;
        stream.emit.lastCall.args[0].should.eql('close');
        stream.emit.lastCall.args[1].should.eql(1000);
      });

      it('does not re-connect', function () {
        stream.close();
        stream.retry.should.not.have.property('timeout');
      });
    });

    describe('when closed unexpectedly', function () {
      beforeEach(function () {
        stream.retry.delay = 15;
        stream.socket.readyState = WS.CLOSED;
      });

      it('tries to re-connect', function (done) {
        stream.on('open', function () {
          stream.retry.should.not.have.property('timeout');
          done();
        });

        stream.subscriptions.empty.should.be.true;
        stream.retry.should.not.have.property('timeout');
        stream.socket.emit('close', 4000);
        stream.retry.should.have.property('timeout');
      });

      describe('on-reconnect', function () {
        beforeEach(function () {
          stream.socket.emit('message', JSON.stringify(F.subscriptionsCreated));
        });

        it('tries to restore the subscriptions', function (done) {
          stream.on('open', function () {
            stream.retry.should.not.have.property('timeout');

            stream.subscriptions.empty.should.be.true;
            stream.socket.send.called.should.be.true;

            stream.socket.send.args[0][0]
              .should.have.property('action', 'createSubscriptions');

            stream.socket.send.args[0][0]
              .should.have.property('subscriptions')
              .and.eql(F.subscriptionsCreated.subscriptions);

            done();
          });

          stream.subscriptions.empty.should.be.false;
          stream.socket.send.called.should.be.false;
          stream.socket.emit('close');
        });
      });
    });
  });


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

    it('has an URL', function () {
      s.should.have.property('url');
    });

    it('sets the API key header', function () {
      s.options
        .should.have.property('headers')
        .and.have.property('Zotero-API-Key', 'abc123');
    });

    it('emits an error on invalid message reception', function () {
      var failed = sinon.spy();

      s.on('error', failed);
      s.socket.emit('message', 'badc0de');

      failed.called.should.be.true;
    });

    describe('on connected', function () {
      var message = F.connected;
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

    describe('topic added/removed events', function () {

      var ADDED   = F.topicAdded;
      var REMOVED = F.topicRemoved;
      var UPDATED = F.topicUpdated;

      beforeEach(function () {
        s.socket.emit('open');
        s.socket.emit('message', JSON.stringify(F.connected));
      });

      it('adds topics to existing subscriptions', function () {
        s.subscriptions.topics.should.not.containEql(ADDED.topic);

        s.socket.emit('message', JSON.stringify(ADDED));

        s.subscriptions.topics.should.containEql(ADDED.topic);
      });

      it('removes topics to existing subscriptions', function () {
        s.subscriptions.topics.should.containEql(REMOVED.topic);

        s.socket.emit('message', JSON.stringify(REMOVED));

        s.subscriptions.topics.should.not.containEql(REMOVED.topic);
      });

      it('emits the events and data', function () {
        var spy = sinon.spy();

        s.on('topicAdded', spy);
        s.on('topicRemoved', spy);
        s.on('topicUpdated', spy);
        s.on('foo', spy);

        s.socket.emit('message', JSON.stringify(UPDATED), {});
        s.socket.emit('message', JSON.stringify(ADDED));
        s.socket.emit('message', JSON.stringify(UPDATED));
        s.socket.emit('message', JSON.stringify(REMOVED));
        s.socket.emit('message', JSON.stringify({ event: 'foo' }));

        spy.callCount.should.eql(5);
        spy.args[0][0].should.have.property('topic', UPDATED.topic);
        spy.args[1][0].should.have.property('topic', ADDED.topic);
        spy.args[2][0].should.have.property('version', UPDATED.version);
        spy.args[3][0].should.have.property('topic', REMOVED.topic);
        spy.args[4][0].should.be.empty;
      });
    });
  });

  describe('given a simple multi-key stream', function () {
    var stream;

    beforeEach(function () { stream = new Stream(); });

    it('creates a websocket instance', function () {
      stream.should.have.property('socket');
    });

    it('is a multi-key stream', function () {
      stream.should.have.property('multi', true);
    });

    it('does not set the API key header', function () {
      stream.options
        .should.have.property('headers')
        .and.not.have.property('Zotero-API-Key');
    });

    describe('.subscribe', function () {
      var outbound = F.createSubscriptions;
      var inbound  = F.subscriptionsCreated;

      beforeEach(function () {
        stream.socket.readyState = WS.OPEN;
        sinon.spy(stream, 'emit');
      });

      afterEach(function () { stream.emit.restore(); });

      it('sends a create subscription message', function () {
        stream.subscribe(outbound.subscriptions);

        stream.socket.send.called.should.be.true;

        stream.socket.send.args[0][0]
          .should.have.property('action', outbound.action);

        stream.socket.send.args[0][0]
          .should.have.property('subscriptions')
          .and.have.length(outbound.subscriptions.length);
      });

      describe('when successful', function () {
        beforeEach(function () {
          stream.socket.emit('message', JSON.stringify(inbound));
        });

        it('updates the local subscriptions', function () {
          stream.subscriptions.topics
            .should.containEql(inbound.subscriptions[0].topics[0]);
          stream.subscriptions.topics
            .should.not.containEql(inbound.errors[0].topic);
        });

        it('emits the event', function () {
          stream.emit.called.should.be.true;
          stream.emit.lastCall.args[0].should.eql(inbound.event);
        });
      });

      describe('when not connected', function () {
        var cb;

        beforeEach(function () {
          cb = sinon.spy();

          stream.socket.readyState = WS.CONNECTING;
          stream.subscribe(outbound.subscriptions, cb);
        });

        it('does not send the subscription message', function () {
          stream.socket.send.called.should.be.false;
        });

        it('does not call the callback', function () {
          cb.called.should.be.false;
        });

        it('adds the subscriptions locally', function () {
          stream.subscriptions.topics
            .should.containEql(inbound.subscriptions[0].topics[0]);
          stream.subscriptions.topics
            .should.containEql(inbound.errors[0].topic);
        });

        describe('once connected', function () {
          beforeEach(function () {
            stream.socket.readyState = WS.OPEN;
            stream.socket.emit('open');
          });

          it('sends the subscription message', function () {
            stream.socket.send.called.should.be.true;
          });

          it('calls the callback', function () {
            cb.called.should.be.true;
          });

          describe('on created/errors', function () {
            beforeEach(function () {
              stream.socket.emit('message', JSON.stringify(inbound));
            });

            it('updates local subscriptions accordingly', function () {
              stream.subscriptions.topics
                .should.containEql(inbound.subscriptions[0].topics[0]);
              stream.subscriptions.topics
                .should.not.containEql(inbound.errors[0].topic);
            });
          });
        });
      });
    });

    describe('.unsubscribe', function () {

      beforeEach(function () {
        sinon.spy(stream.subscriptions, 'cancel');
        sinon.spy(stream, 'emit');

        stream.socket.readyState = WS.OPEN;
        stream.unsubscribe({ apiKey: 'foo' });
      });

      afterEach(function () {
        stream.subscriptions.cancel.reset();
        stream.emit.reset();
      });

      it('cancels subscriptions locally', function () {
        stream.subscriptions.cancel.calledWith([{ apiKey: 'foo' }]);
      });

      it('sends the unsubscription message', function () {
        stream.socket.send.calledOnce.should.be.true;

        stream.socket.send.args[0][0].should.have.property('action', 'deleteSubscriptions');

        stream.socket.send.args[0][0]
          .should.have.property('subscriptions')
          .and.have.length(1);
      });

      describe('on confirm', function () {
        beforeEach(function () {
          stream.socket.emit('message', '{"event": "subscriptionsDeleted"}');
        });

        it('emits the event', function () {
          stream.emit.lastCall.args[0].should.eql('subscriptionsDeleted');
        });
      });
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
