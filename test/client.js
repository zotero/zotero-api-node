var Client = require('../lib/client');

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

});
