BIN = ./node_modules/.bin
ISTANBUL = ./node_modules/.bin/istanbul

SRC = lib/*.js
TEST = test/*.js

doc:
	${BIN}/yuidoc .

lint:
	@${BIN}/eslint --reset -c .eslintrc ${SRC} ${TEST}

test: lint
	@${BIN}/mocha ${TEST}

debug:
	@${BIN}/mocha debug ${TEST}

test-travis:
	${BIN}/istanbul cover ${BIN}/_mocha --report-lcovonly -- ${TEST}

spec:
	@${BIN}/mocha --reporter spec ${TEST}

coverage: clean
	${BIN}/istanbul cover ${BIN}/_mocha -- ${TEST}

watch:
	@DEBUG=zotero:watch ./watch.js

clean:
	rm -rf ./coverage
	rm -rf ./doc

.PHONY: lint doc clean test debug test-travis spec watch coverage
