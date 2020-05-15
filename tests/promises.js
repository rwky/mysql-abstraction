/* global test, suite, suiteSetup */
suite('Promises', function () {
  const {
    assert
  } = require('chai')
  const async = require('async')
  let mysql, Connection
  suiteSetup(function (done) {
    mysql = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'mysql',
      port: process.env.MYSQL_PORT || 3306
    })
    Connection = mysql.connection

    const q = new Connection()
    async.series([
      c => q.q({ q: 'SET GLOBAL max_connections=1000', cb: c }),
      c => q.q({ q: 'DROP DATABASE IF EXISTS test', cb: c }),
      c => q.q({ q: 'CREATE DATABASE IF NOT EXISTS test', cb: c }),
      c => q.q({
        q: 'CREATE TABLE IF NOT EXISTS test.innodb_deadlock_maker(a INT PRIMARY KEY) ENGINE=innodb',
        cb: c
      }),
      c => q.q({ q: 'CREATE TABLE test.lockTest (test varchar(30))', cb: c }),
      c => q.q({ q: 'TRUNCATE TABLE test.lockTest', cb: c }),
      c => q.q({ q: 'INSERT INTO test.lockTest VALUES ("test")', cb: c }),
      c => q.q({ q: 'CREATE TABLE test.empty_table (test varchar(30))', cb: c }),
      c => q.end(c)
    ], done)
  })

  test('select', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT 1 AS k' }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(done)
    })
  })

  test('select-params', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT ? AS k', params: [1] }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(done)
    })
  })

  test('select-aliases', function (done) {
    const q = new Connection()
    q.q({ sql: 'SELECT ? AS k', values: [1] }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(done)
    })
  })

  test('lock1', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT 1 AS k', lock: 1 }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(done)
    })
  })

  test('lock2', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT 1 AS k', lock: 2 }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(done)
    })
  })

  test('lock-functions', function (done) {
    const q = new Connection(true)
    const q2 = new Connection(true)
    q.row({
      q: 'SELECT * FROM test.lockTest',
      lock: 2
    }).then((data) => {
      assert.equal('test', data.test)
      q2.row({
        q: 'SELECT * FROM test.lockTest',
        lock: 2
      }).then((data) => {
        assert.equal('test2', data.test)
        q2.end(done)
      })
      q.q({ q: 'UPDATE test.lockTest SET test="test2"' }).then(() => {
        setTimeout(() => q.end(() => null)
          , 100)
      })
    })
  })

  test('stream', function (done) {
    const q = new Connection()
    let result = 0
    const stream = function (row) {
      result = row.k
    }

    q.q({ q: 'SELECT 1 AS k', lock: 2, stream }).then(() => {
      assert.equal(1, result)
      q.end(done)
    })
  })

  test('end', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT 1 AS k' }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(() => q.end(done))
    })
  })

  test('endwithops', function (done) {
    const q = new Connection()
    q.q({ q: 'SELECT 1 AS k' }).then((data) => {
      assert.equal(data[0].k, 1)
      q.end(() => q.end({ timeout: 30000 }, done))
    })
  })

  test('commit', function (done) {
    const q = new Connection()
    const doTest = async () => {
      await q.begin()
      const data = await q.q({ q: 'SELECT 1 AS k' })
      assert.equal(data[0].k, 1)
      await q.commit()
      await q.end()
      done()
    }
    doTest()
  })

  test('timeout', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    q.begin(() => q.q({ q: 'SELECT SLEEP(10)', timeout: 1 }).catch((err) => {
      assert.equal(err.code, 'PROTOCOL_SEQUENCE_TIMEOUT')
      done()
    }))
  })

  test('error', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    q.q({ q: 'SELECT 1 AS k FROM no_table' }).catch((err) => {
      assert.equal(err.code, 'ER_NO_SUCH_TABLE')
      done()
    })
  })

  test('streamerror', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    let result = 0
    const stream = function (row) { result = row.k }

    q.q({ q: 'SELECT 1 AS k FROM no_table', lock: 2, stream }).catch((err) => {
      assert.equal(err.code, 'ER_NO_SUCH_TABLE')
      assert.equal(result, 0)
      done()
    })
  })

  test('batch', function (done) {
    const q = new Connection()
    const queries = []
    queries.push({ q: 'SELECT 1 AS k' })
    queries.push({ q: 'SELECT 2 AS k' })
    q.batch(queries).then((data) => {
      assert.equal(data[0][0].k, 1)
      assert.equal(data[1][0].k, 2)
      q.end(done)
    })
  })

  test('batcherror', function (done) {
    const q = new Connection()
    const queries = []
    q.on('error', () => null)
    q.batch(queries).catch((err) => {
      assert.equal(err.message, 'Cannot batch 0 queries')
      done()
    })
  })

  test('batcherror2', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    const queries = []
    queries.push({ q: 'SELECT 1 AS k FROM no_table' })
    q.batch(queries).catch((err) => {
      assert.equal(err.code, 'ER_NO_SUCH_TABLE')
      done()
    })
  })

  test('enqueue', function (done) {
    const qs = []
    mysql.pool.once('enqueue', function () {
      assert.equal(mysql.pool._connectionQueue.length, 1)
      async.each(qs, (q, c) => q.end(c)
        , done)
    })

    const queue = async () => {
      for (let i = 0; i <= 10; i++) {
        const q = new Connection()
        qs.push(q)
        await q.begin()
      }
    }
    queue()
  })

  test('logs', function (done) {
    const q = new Connection()
    q.log = true
    q.q({ q: 'SELECT 1 AS k' }).then((data) => {
      assert.equal(q.logs[0].q, 'SELECT 1 AS k')
      q.end(done)
    })
  })

  test('row', function (done) {
    const q = new Connection()
    q.row({ q: 'SELECT 1 AS k' }).then((data) => {
      assert.equal(data.k, 1)
      q.end(done)
    })
  })

  test('count', function (done) {
    const q = new Connection()
    q.count({ q: 'SELECT count(*)' }).then((data) => {
      assert.equal(data, 1)
      q.end(done)
    })
  })

  test('warningsAreErrors', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    q.q({
      q: 'DROP TABLE IF EXISTS test.warnings_test',
      warningsAreErrors: true
    }).catch((err) => {
      assert.equal(err.message, 'Warnings treated as errors 1')
      assert.equal(err.warnings[0].Message, "Unknown table 'test.warnings_test'")
      done()
    })
  })

  test('warningsAreErrorsNotEnabled', function (done) {
    const q = new Connection()
    q.q({
      q: 'DROP TABLE IF EXISTS test.warnings_test'
    }).catch((err) => {
      assert.isNull(err)
    }).finally(() => q.end(done))
  })

  test('deadlocks', function (done) {
    const q = new Connection(true)
    const q2 = new Connection(true)
    let deadlocks = 0
    q2.on('deadlock', function () { deadlocks += 1 })

    const doDeadlocks = async () => {
      await q.q({ q: 'SET autocommit=0' })
      await q2.q({ q: 'SET autocommit=0' })
      await q.q({ q: 'INSERT INTO test.innodb_deadlock_maker VALUES(1)' })
      q2.q({ q: 'SELECT * FROM test.innodb_deadlock_maker FOR UPDATE' }).then(() => {
        assert.equal(deadlocks, 1)
        q2.end().then(() => done())
      })
      setTimeout(() =>
        q.q({ q: 'INSERT INTO test.innodb_deadlock_maker VALUES(0);' }).then(() => q.end())
      , 1000)
    }
    doDeadlocks()
  })

  test('statsSelect', function (done) {
    const q = new Connection()
    q.q({
      q: 'SELECT 1'
    }).then(() => {
      assert.equal(q.stats.select, 1)
      q.end(done)
    })
  })

  test('statsInsert', function (done) {
    const q = new Connection()
    q.q({
      q: 'INSERT INTO test.lockTest VALUES("insert")'
    }).then(() => {
      assert.equal(q.stats.insert, 1)
      q.end(done)
    })
  })

  test('statsUpdate', function (done) {
    const q = new Connection()
    q.q({
      q: 'UPDATE test.lockTest SET test="update"'
    }).then(() => {
      assert.equal(q.stats.update, 1)
      q.end(done)
    })
  })

  test('statsDelete', function (done) {
    const q = new Connection()
    q.q({
      q: 'DELETE FROM test.lockTest'
    }).then(() => {
      assert.equal(q.stats.delete, 1)
      q.end(done)
    })
  })

  test('statsSelectDisabled', function (done) {
    const q = new Connection()
    q.gatherStats = false
    q.q({
      q: 'SELECT 1'
    }).then(() => {
      assert.equal(q.stats.select, 0)
      q.end(done)
    })
  })

  test('testRowWithoutResults', function (done) {
    const q = new Connection()
    q.row({
      q: 'SELECT * FROM test.empty_table'
    }).then((data) => {
      assert.equal(data, null)
      done()
    })
  })

  test('testCountWithoutResults', function (done) {
    const q = new Connection()
    q.count({
      q: 'SELECT test FROM test.empty_table'
    }).then((data) => {
      assert.equal(data, null)
      done()
    })
  })

  test('testNoReconnect', function (done) {
    const q = new Connection()
    q.on('error', () => null)
    q.count({
      q: 'SELECT 1'
    }).then((data) => {
      assert.equal(data, 1)
      assert.equal(q.connectionAttempts, 1)
      done()
    })
  })

  test('testReconnect', function (done) {
    const mysqlTmp = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'mysql',
      port: process.env.MYSQL_PORT || 3306
    })
    const ConnectionTmp = mysqlTmp.connection
    const q = new Connection()
    const qTmp = new ConnectionTmp()
    qTmp.on('error', () => null)

    const doTest = async () => {
      await q.q({ q: 'SET GLOBAL max_connections = 1' })
      qTmp.count({
        q: 'SELECT 1'
      }).then((data) => {
        assert.equal(data, 1)
        assert.equal(qTmp.connectionAttempts, 2)
        done()
      })

      setTimeout(async () => {
        await q.q({ q: 'SET GLOBAL max_connections = 1000' })
        await q.end()
      }, 300)
    }

    doTest()
  })

  test('testFailedReconnect', function (done) {
    const mysqlTmp = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'mysql',
      port: process.env.MYSQL_PORT || 3306
    })
    const ConnectionTmp = mysqlTmp.connection
    const q = new Connection()
    const qTmp = new ConnectionTmp()
    qTmp.on('error', () => null)

    const doTest = async () => {
      await q.q({ q: 'SET GLOBAL max_connections = 1' })
      try {
        await qTmp.count({ q: 'SELECT 1' })
      } catch (err) {
        assert.equal(qTmp.connectionAttempts, 4)
        assert.equal(err.code, 'ER_CON_COUNT_ERROR')
        await q.q({
          q: 'SET GLOBAL max_connections = 1000'
        })
        await q.end()
        done()
      }
    }

    doTest()
  })
})
