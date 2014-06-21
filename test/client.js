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

  describe('#get', function () {
    it('sends an HTTPS request to the API server', function (done) {
      var path = '/users/475425/collections/9KH9TNSJ/items';

      nock('https://api.zotero.org')
        .get(path)
        .reply(200, '<?xml version="1.0"');

      client.get(path, function (error, data, res) {
        (!error).should.be.true;

        res.statusCode.should.eql(200);
        data.toString().should.startWith('<?xml version="1.0"');

        done();
      });
    });

    it('calls back with an error for non 2xx responses', function (done) {
      var path = '/there-is-no-spoon';

      nock('https://api.zotero.org')
        .get(path)
        .reply(404, 'Not found');

      client.get(path, function (error, data, res) {
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

      client.get(path, { format: 'versions' }, function (error, data, res) {
        (!error).should.be.true;

        res.statusCode.should.eql(200);
        res.headers['content-type'].should.match(/json/i);

        data.should.be.an.Object;
        data.should.not.be.empty;
        data.foo.should.eql(23);

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
