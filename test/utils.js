'use strict';

var utils = require('../lib/utils');

describe('Zotero.utils', function () {

  describe('#downcase', function () {
    var downcase = utils.downcase;

    it('returns a new object', function () {
      var x = { foo: 'bar' };
      downcase(x).should.not.equal(x);
    });

    it('converts all keys to lower case', function () {
      downcase({}).should.be.empty;
      downcase({ FOo: 1 }).should.have.property('foo', 1);
      downcase({ foo: 1 }).should.have.property('foo', 1);
      downcase({ Foo: 1, Bar: 2 }).should.have.properties('foo', 'bar');
    });
  });

  describe('#pick', function () {
    var pick = utils.pick;

    it('picks the passed-in keys from the object', function () {
      pick({}).should.be.empty;
      pick({ foo: 1, bar: 2 }, 'foo').should.have.properties({ foo: 1 });
      pick({ foo: 1, bar: 2 }, 'bar').should.have.properties({ bar: 2 });
      pick({ foo: 1, bar: 2 }, 'bar', 'foo').should.have.properties({ foo: 1, bar: 2 });

      pick({ foo: 1, bar: 2 }, ['foo']).should.have.properties({ foo: 1 });
      pick({ foo: 1, bar: 2 }, ['bar']).should.have.properties({ bar: 2 });
      pick({ foo: 1, bar: 2 }, ['bar', 'foo']).should.have.properties({ foo: 1, bar: 2 });
    });
  });

  describe('#omit', function () {
    var omit = utils.omit;

    it('picks all but the passed-in keys from the object', function () {
      omit({}).should.be.empty;
      omit({ foo: 1, bar: 2 }, 'foo').should.have.properties({ bar: 2 });
      omit({ foo: 1, bar: 2 }, 'bar').should.have.properties({ foo: 1 });
      omit({ foo: 1, bar: 2 }, 'bar', 'foo').should.be.empty;
      omit({ foo: 1, bar: 2 }).should.have.properties({ foo: 1, bar: 2 });
      omit({ foo: 1, bar: 2 }, 'baz').should.have.properties({ foo: 1, bar: 2 });

      omit({ foo: 1, bar: 2 }, ['bar', 'foo']).should.be.empty;
      omit({ foo: 1, bar: 2 }, ['baz', 'foo']).should.have.properties({ bar: 2 });
    });
  });
});
