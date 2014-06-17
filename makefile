SRC = lib/*.js
include node_modules/make-lint/index.mk

BIN = ./node_modules/.bin
ISTANBUL = ./node_modules/.bin/istanbul

TEST = test/*.js

test:
	@${BIN}/mocha ${TEST}

test-api:
	@NOCK_OFF=true ${BIN}/mocha -t 5000 ${TEST}

test-travis:
	${BIN}/istanbul cover ${BIN}/_mocha --report-lcovonly -- ${TEST}

spec:
	@${BIN}/mocha --reporter spec ${TEST}

coverage: clean
	${BIN}/istanbul cover ${BIN}/_mocha -- ${TEST}

watch:
	@DEBUG=zotero:watch ./watch.js

clean:
	rm -rf ./coverage/*

.PHONY: clean test spec watch coverage
