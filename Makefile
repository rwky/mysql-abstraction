
COFFEE ?= ./node_modules/.bin/coffee
MOCHA ?= node_modules/.bin/_mocha
_MOCHA ?= ./node_modules/.bin/_mocha
MOCHA_REPORTER ?= spec
ISTANBUL ?= ./node_modules/.bin/istanbul
ISTANBUL_OUT ?= ./reports/coverage
ISTANBUL_REPORT ?= lcov
ISTANBUL_LCOV_INFO_PATH ?= $(ISTANBUL_OUT)/lcov.info
ISTANBUL_HTML_REPORT_PATH ?= $(ISTANBUL_OUT)/lcov-report/index.html
TESTS_COFFEE ?= tests/*.coffee
TESTS ?= tests/*.js
COFFEELINT ?= ./node_modules/.bin/coffeelint
        
coffee:
	$(COFFEE) -c -b lib/index.coffee
	$(COFFEE) -c -b $(TESTS_COFFEE)

test: coffee
	$(MOCHA) --reporter $(MOCHA_REPORTER) --ui tdd $(TESTS)

coverage: coffee
	$(ISTANBUL) cover --dir $(ISTANBUL_OUT) --report $(ISTANBUL_REPORT) $(_MOCHA) -- --reporter $(MOCHA_REPORTER) --ui tdd $(TESTS)
	
lint:
	$(COFFEELINT) -f coffeelint.json lib/*.coffee tests/*.coffee

publish:
	rm -rf npm.tar
	mkdir tar
	cp -a lib/ tests/ package.json README.md coffeelint.json Makefile CHANGELOG.md tar/
	tar -czf npm.tar tar 
	npm publish npm.tar
	
.PHONY: test coverage coffee lint publish
