SRC = lib/*.js
include node_modules/make-lint/index.mk

test:
	@./node_modules/mocha/bin/mocha test/*.js

watch:
	@DEBUG=zotero:watch ./watch.js

.PHONY: test watch
