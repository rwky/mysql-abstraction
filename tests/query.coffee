assert = require('chai').assert
async = require 'async'
mysql = require('../lib/index')({
    user: process.env.MYSQL_USER, host: process.env.MYSQL_HOST,
    password: process.env.MYSQL_PASSWORD, connectionLimit: 10,
    database: 'mysql'
    })
Connection = mysql.connection

suite 'Query', ->
    before (done) ->
        q = new Connection
        async.series [
            (c) -> q.q q: 'CREATE DATABASE IF NOT EXISTS test', cb: c
            (c) -> q.q q: 'CREATE TABLE IF NOT EXISTS 
            test.innodb_deadlock_maker(a INT PRIMARY KEY) ENGINE=innodb', cb: c
            (c) -> q.q q: 'CREATE TABLE test.lockTest (test varchar(30))', cb: c
            (c) -> q.q q: 'TRUNCATE TABLE test.lockTest', cb: c
            (c) -> q.q q: 'INSERT INTO test.lockTest VALUES ("test")', cb: c
            (c) ->  q.end c
        ], done

    test 'select', (done) ->
        q =  new Connection
        q.q q: 'SELECT 1 AS k', cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end done

    test 'select-params', (done) ->
        q =  new Connection
        q.q q: 'SELECT ? AS k', params: [1], cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end done

    test 'select-aliases', (done) ->
        q =  new Connection
        q.q sql: 'SELECT ? AS k', values: [1], cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end done
                    
    test 'lock1', (done) ->
        q =  new Connection
        q.q q: 'SELECT 1 AS k', lock: 1, cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end done
    
    test 'lock2', (done) ->
        q =  new Connection
        q.q q: 'SELECT 1 AS k', lock: 2, cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end done
                
    test 'lock-functions', (done) ->
        q = new Connection true
        q2 = new Connection true
        q.row 
            q: 'SELECT * FROM test.lockTest'
            lock: 2
            cb: (err, data) ->
                q2.row 
                    q: 'SELECT * FROM test.lockTest'
                    lock: 2
                    cb: (err, data) ->
                        assert.equal 'test2', data.test
                        q2.end done
                              
                assert.equal 'test', data.test
                q.q q: 'UPDATE test.lockTest SET test="test2"', cb: ->
                    setTimeout ->
                        q.end ->  null
                    , 100
    test 'stream', (done) ->
        q =  new Connection
        result = 0
        stream = (row) ->
            result = row.k
        
        q.q q: 'SELECT 1 AS k', lock: 2, stream: stream, cb: ->
            assert.equal 1, result
            q.end done
                
    test 'end', (done) ->
        q =  new Connection
        q.q q: 'SELECT 1 AS k', cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end -> q.end done
            
    test 'endwithops', (done) ->
        q =  new Connection
        q.q q: 'SELECT 1 AS k', cb: (err, data) ->
            assert.equal data[0].k, 1
            q.end -> q.end {timeout: 30000}, done
            
    
    test 'commit', (done) ->
        q =  new Connection
        q.begin ->
            q.q q: 'SELECT 1 AS k', cb: (err, data) ->
                assert.equal data[0].k, 1
                q.commit -> q.end done
    
    test 'timeout', (done) =>
        @timeout 20000
        q =  new Connection
        q.on 'error', (err) -> null
        q.begin ->
            q.q q: 'SELECT SLEEP(10)', timeout: 1, cb: (err, data) ->
                assert.equal err.code, 'PROTOCOL_SEQUENCE_TIMEOUT'
                done()

    test 'error', (done) ->
        q =  new Connection
        q.on 'error', -> null
        q.q q: 'SELECT 1 AS k FROM no_table', cb: (err, data) ->
            assert.equal err.code, 'ER_NO_SUCH_TABLE'
            done()
           
    test 'streamerror', (done) ->
        q =  new Connection
        q.on 'error', -> null
        result = 0
        stream = (row) ->
            result = row.k
        
        q.q q: 'SELECT 1 AS k FROM no_table', lock: 2, stream: stream, cb: (err) ->
            assert.equal err.code, 'ER_NO_SUCH_TABLE'
            done()
     
    test 'batch', (done) ->
        q =  new Connection
        queries = []
        queries.push q: 'SELECT 1 AS k'
        queries.push q: 'SELECT 2 AS k'
        q.batch queries, (err, data) ->
            assert.equal data[0][0].k, 1
            assert.equal data[1][0].k, 2
            q.end done
          
    test 'batcherror', (done) ->
        q =  new Connection
        queries = []
        q.on 'error', -> null
        q.batch queries, (err, data) ->
            assert.equal err.message, 'Cannot batch 0 queries'
            done()
            
    test 'batcherror2', (done) ->
        q =  new Connection
        q.on 'error', -> null
        queries = []
        queries.push q: 'SELECT 1 AS k FROM no_table'
        q.batch queries, (err, data) ->
            assert.equal err.code, 'ER_NO_SUCH_TABLE'
            done()
            
    test 'enqueue', (done) ->
        qs = []
        mysql.pool.once 'enqueue', ->
            assert.equal mysql.pool._connectionQueue.length, 1
            async.each qs, (q, c) ->
                q.end c
            , done

        async.whilst ->
            mysql.pool._allConnections.length <= 10
        , (c) ->
            q = new Connection
            qs.push q
            q.begin c
            
    test 'logs', (done) ->
        q = new Connection
        q.log = true
        q.q q: 'SELECT 1 AS k', cb: (err, data) ->
            assert.equal q.logs[0].q, 'SELECT 1 AS k'
            q.end done
            
    test 'row', (done) ->
        q = new Connection
        q.row q: 'SELECT 1 AS k', cb: (err, data) ->
            assert.equal data.k, 1
            q.end done
    
    test 'count', (done) ->
        q = new Connection
        q.count q: 'SELECT count(*)', cb: (err, data) ->
            assert.equal data, 1
            q.end done

    test 'warningsAreErrors', (done) ->
        q = new Connection
        q.q q: 'CREATE TEMPORARY TABLE warnings_test (test_col VARCHAR(5));', cb: (err) ->
            if err then throw err
            q.on 'error', -> null
            q.q q: 'INSERT INTO warnings_test SET test_col="123456"', warningsAreErrors: true,
            cb: (err) ->
                assert.equal err.message, 'Warnings treated as errors 1'
                assert.equal err.warnings[0].Message, 
                "Data truncated for column 'test_col' at row 1"
                done()

    test 'warningsAreErrorsNotEnabled', (done) ->
        q = new Connection
        q.q 
            q: 'CREATE TEMPORARY TABLE IF NOT EXISTS warnings_test (test_col VARCHAR(5));'
            cb: (err) ->
                if err then throw err
                q.q q: 'INSERT INTO warnings_test SET test_col="123456"', cb: (err) ->
                    assert.isNull err
                    q.end done
 
    test 'deadlocks', (done) =>
        @timeout 65000
        q = new Connection true
        q2 = new Connection true
        deadlocks = 0
        q2.on 'deadlock', ->
            deadlocks += 1

        async.series [
            (c) ->
                q.q q: 'SET autocommit=0', cb: c
            (c) ->
                q2.q q: 'SET autocommit=0', cb: c
            (c) ->
                q.q q: 'INSERT INTO test.innodb_deadlock_maker VALUES(1)', cb: c
            (c) ->
                q2.q q: 'SELECT * FROM test.innodb_deadlock_maker FOR UPDATE', cb: ->
                    assert.equal deadlocks, 1
                    q2.end done
                setTimeout c, 1000
            (c) ->
                q.q q: 'INSERT INTO test.innodb_deadlock_maker VALUES(0);', cb: c
            (c) ->
                q.end c
        ]

    test 'statsSelect', (done) ->
        q = new Connection
        q.q
            q: 'SELECT 1'
            cb: (err) ->
                if err then throw err
                assert.equal q.stats.select, 1
                q.end done
    
    test 'statsInsert', (done) ->
        q = new Connection
        q.q
            q: 'INSERT INTO test.lockTest VALUES("insert")'
            cb: (err) ->
                if err then throw err
                assert.equal q.stats.insert, 1
                q.end done
                
    test 'statsUpdate', (done) ->
        q = new Connection
        q.q
            q: 'UPDATE test.lockTest SET test="update"'
            cb: (err) ->
                if err then throw err
                assert.equal q.stats.update, 1
                q.end done

    test 'statsDelete', (done) ->
        q = new Connection
        q.q
            q: "DELETE FROM test.lockTest"
            cb: (err) ->
                if err then throw err
                assert.equal q.stats.delete, 1
                q.end done

    test 'statsSelectDisabled', (done) ->
        q = new Connection
        q.gatherStats = false
        q.q
            q: "SELECT 1"
            cb: (err) ->
                if err then throw err
                assert.equal q.stats.select, 0
                q.end done
