COFFEE ?= ./node_modules/.bin/coffee
MOCHA ?= ./node_modules/.bin/_mocha
MOCHA_REPORTER ?= spec
ISTANBUL ?= ./node_modules/.bin/istanbul
ISTANBUL_OUT ?= ./reports/coverage
ISTANBUL_REPORT ?= lcov
TESTS_COFFEE ?= tests/*.coffee
TESTS ?= tests/*.js
COFFEELINT ?= ./node_modules/.bin/coffeelint
COVERALLS ?= ./node_modules/.bin/coveralls
        
coffee:
	$(COFFEE) -c -b lib/index.coffee
	$(COFFEE) -c -b $(TESTS_COFFEE)

test: coffee
	$(MOCHA) --exit --reporter $(MOCHA_REPORTER) --ui tdd $(TESTS) --timeout 5000

coverage: coffee
	$(ISTANBUL) cover --dir $(ISTANBUL_OUT) --report $(ISTANBUL_REPORT) $(MOCHA) -- --exit --reporter $(MOCHA_REPORTER) --ui tdd $(TESTS) --timeout 5000
	

coveralls: coverage
	cat $(ISTANBUL_OUT)/lcov.info | $(COVERALLS)

lint:
	$(COFFEELINT) -f coffeelint.json lib/*.coffee tests/*.coffee

publish:
	rm -rf npm.tar tar
	mkdir tar
	cp -a lib/ tests/ package.json README.md coffeelint.json Makefile CHANGELOG.md tar/
	tar -czf npm.tar tar 
	npm publish npm.tar
	
.PHONY: test coverage coffee lint publish
