#!/usr/bin/env node

var watch = require('watch');
var debug = require('debug')('zotero:watch');
var exec  = require('child_process').exec;

['lib', 'test'].forEach(function (dir) {
  watch.createMonitor(dir, function (monitor) {
    monitor.on('changed', changed);
  });

  debug('watching %s directory', dir);
});


function changed(file) {
  if (ignore(file)) return null;

  debug('changed: %s', file);

  exec('make test', function (_, stdout, stderr) {
    stdout = stdout.replace(/^make\[\d\]:.+$/mg, '');
    stderr = stderr.replace(/^make(file|\[\d\]):.+$/mg, '');

    console.log(stdout);
    console.error(stderr);
  });
}

function ignore(file) {
  if ((/^\.|swp$/).test(file)) return true;

  return false;
}
