var Client = require('../lib/client'),
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

  describe('#request', function () {
    it('sends an HTTPS request to the API server', function (done) {
      var path = '/users/475425/collections/9KH9TNSJ/items';

      nock('https://api.zotero.org')
        .get(path)
        .reply(200, 'foo');

      client.get(path, function (error, res, data) {
        (!error).should.be.true;

        res.statusCode.should.eql(200);
        data.toString().should.eql('foo');

        done();
      });
    });
  });
});
