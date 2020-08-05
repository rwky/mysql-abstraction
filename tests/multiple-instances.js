/* global test, suite, suiteSetup */
suite('Multiple instances', function () {
  const {
    assert
  } = require('chai')
  suiteSetup(function (done) {
    const mysql = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'mysql',
      port: process.env.MYSQL_PORT || 3306
    })

    const q = new mysql.Connection()
    q.q({ q: 'CREATE DATABASE IF NOT EXISTS test' }).then(() => {
      q.end().then(done)
    })
  })

  test('multiple-instances', async function () {
    const mysql1 = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'mysql',
      port: process.env.MYSQL_PORT || 3306
    })
    const mysql2 = require('../lib/index')({
      user: process.env.MYSQL_USER || 'root',
      host: process.env.MYSQL_HOST || '127.0.0.1',
      password: process.env.MYSQL_PASSWORD || '',
      connectionLimit: 10,
      database: 'test',
      port: process.env.MYSQL_PORT || 3306
    })
    const q1 = new mysql1.Connection()
    const q2 = new mysql2.Connection()
    const d1 = await q1.q({ q: 'SELECT DATABASE() AS d' })
    assert.equal('mysql', d1[0].d)
    const d2 = await q2.q({ q: 'SELECT DATABASE() AS d' })
    assert.equal('test', d2[0].d)
  })
})
