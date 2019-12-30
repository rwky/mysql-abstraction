## 2019-12-30 (4.3.2) 

* Updated npm deps

## 2019-07-16 (4.3.1)

* Updated npm deps

## 2018-05-02 (4.3.0)

* Updated npm deps

## 2018-12-18 (4.2.0)

* Updated License to more permission LGPLv3
* Updated deps
* Added node 11 to travis
* Added connection retrying. By default connections are retried 4 times every 500ms
* Improved error handling when connections fail
* Increased global tests timeout
* Added utility script to run tests locally

## 2018-07-24 (4.1.0)

* Updated deps, now supports Node 9 and 10

## 2018-06-30 (4.0.0)

* Updated deps, updated to coffeescript 2
* Updated travis config
* Updated README badges

## 2017-12-01 (3.1.0)

* Updated dev deps
* Updated node-mysql to 2.15.x
* Retry failed queries when ER_LOCK_WAIT_TIMEOUT is thrown as well as ER_LOCK_DEADLOCK

## 2017-06-08 (3.0.3) 

* Updated dev deps
* Added MYSQL_PORT to testing
* Fixed a bug where if q.on 'error' was specified and row or count didn't return data node would throw an error "Cannot read property '0' of undefined"

## 2017-05-19 (3.0.2)

* Updated deps

## 2017-04-25 (3.0.1)

* Added lastOps to Connection object useful for debuggig 

## 2017-04-14 (3.0.0)

* Updated async to 2.3.x
* Added stats collection which is enabled by default

## 2017-02-06 (2.2.2)

* Updated node-mysql to 2.13.x
* Updated dev deps

## 2016-11-03 (2.2.1)

* Updated node-mysql to 2.12.x
* Updated async to 2.1.x
* Updated dev deps
* Fixed makefile publishing

## 2016-06-08 (2.1.0)

* Updated dev deps
* Update node-mysql to 2.11.x

## 2016-01-18 (2.0.0)

* Updated deps and removed obsolete deps
* Added retrying of transactions that fail due to deadlock
* Enhanced tests
* Updated License

## 2015-08-22 (1.5.0) 

* Updated node-mysql to 2.9.x
* Fixed issue with locks not working
* Fixed issue with lastQuery not working with streams

## 2015-07-14 (1.4.0)

* Updated node-mysql to 2.8.x

## 2015-07-08 (1.3.0)

* Added waringsAreErrors option to treat mysql warnings as errors
* Updated node-mysql to 2.7.x

## 2015-05-11 (1.2.0)

* Allow passing of timeouts to queries (and other arbitary keys via ops)
* ops.values is an alias for ops.params
* ops.sql is an alias for ops.q

## 2015-05-04 (1.1.1)

* Fixed error emitting when batching 0 queries to be an Error object

## 2015-03-21 (1.1.0)

* Bumped deps

## 2015-03-21 (1.0.0)

* Removed deprecated queue event
* Added option to send arguments i.e. timeout to COMMIT when running Connection.end
* Connection.end requires at least one argument which is the callback

## 2015-02-24 (0.4.2)

* Bumped deps

## 2015-01-23 (0.4.0)

* Always add the query to error objects as err.query so they can be caught by domains

## 2015-01-22 (0.3.0)

* Changed the cb option is mandatory for queries
* Added count method which assumes the first field returned from the first row is the COUNT function
* Added row method which returns the first row
* Added coffeelint
* Updated depd
* Updated mocha

## 2014-09-24 (0.2.0)

* Upgraded node-mysql to 2.5.1
* Fixed queued connection not being removed from pool if end is called
* Fixed on queue deprecation to work how it used to
* Added logging of queries per connection

## 2014-09-11 (0.1.0)

* Added support for node-mysql 2.5.0 enqueue event
* Deprecated connection 'queue' event

## 2014-08-09 (0.0.14)

* Initial commit
