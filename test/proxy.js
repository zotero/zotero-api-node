var proxy = require('../lib/proxy'),
  sinon = require('sinon');

describe('zotero.proxy', function () {
  var ctx, target, p;

  it('returns a proxy function', function () {
    proxy().should.be.a.Function;
  });

  describe('when bound to context and target', function () {
    beforeEach(function () {
      ctx = {};
      target = sinon.spy();

      p = proxy(ctx, target, 'prefix');
    });

    describe('when called', function () {

      it('calls the target on the context', function () {
        p();

        target.called.should.be.true;
        target.callCount.should.equal(1);
        target.calledOn(ctx).should.be.true;

        p();
        target.callCount.should.equal(2);
      });

      describe('with a string as first argument', function () {
        it('adds the proxy name as prefix', function () {
          p('bar');
          p('');
          target.args[0][0].should.equal('prefix/bar');
          target.args[1][0].should.equal('prefix');
        });

        it('passes on all other arguments', function () {
          var foo = {}, baz = function () {};

          p('bar', foo, baz);

          target.args[0].length.should.eql(3);
          target.args[0][1].should.equal(foo);
          target.args[0][2].should.equal(baz);
        });
      });


      describe('with no string as first argument', function () {
        it('adds the proxy name as first argument', function () {
          p();
          target.args[0].length.should.eql(1);
          target.args[0][0].should.equal('prefix');
        });

        it('passes on all other arguments', function () {
          var foo = {}, baz = function () {};

          p('bar', foo, baz);

          target.args[0].length.should.eql(3);
          target.args[0][1].should.equal(foo);
          target.args[0][2].should.equal(baz);
        });
      });
    });

  });
});

