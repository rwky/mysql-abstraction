const mysql = require('mysql')
const events = require('events')

module.exports = function (ops) {
  const settings = ops
  const pool = mysql.createPool(settings)
  class Connection extends events.EventEmitter {
    constructor (autoStartTransaction) {
      super()
      if (autoStartTransaction == null) { autoStartTransaction = false }
      this.autoStartTransaction = autoStartTransaction
      this.gatherStats = true
      this.log = false
      this.maxRetries = 3
      this.connectionRetries = 4
      this.connectionRetryInterval = 500
      this._reset()
    }

    _reset () {
      this.hasTransaction = false
      this.connection = null
      this.logs = []
      this._returnConnection = null
      this.queries = []
      this.retries = 0
      this.connectionAttempts = 0
      this.lastQuery = null
      this.lastOps = null
      this.stats = {
        select: 0,
        update: 0,
        delete: 0,
        insert: 0
      }
    }

    connect (cb) {
      this.connectionAttempts += 1
      this._returnConnection = (err, connection) => {
        if (err) {
          if (this.connectionAttempts >= this.connectionRetries) {
            this.emit('error', err)
            cb(err)
          } else {
            setTimeout(() => {
              this.connect(cb)
            }
            , this.connectionRetryInterval)
          }
        } else {
          this.connection = connection
          cb(err)
        }
      }
      pool.getConnection(this._returnConnection)
    }

    async error (err, cb) {
      // deadlock, reissue query
      err.query = this.lastQuery
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(err.code) && (this.retries < this.maxRetries)) {
        this.retries += 1
        this.emit('deadlock', err)
        this.hasTransaction = false
        for (const query of this.queries) {
          await this.q({ q: query.q, params: query.params, retry: true })
        }
        return cb()
      }

      if (settings.logErrors != null) {
        settings.logErrors(err)
      }
      const end = () => {
        this.emit('error', err)
        if (cb) cb(err)
      }
      if (this.connection) {
        this.connection.query('ROLLBACK', e => {
          if (e) err.rollbackErr = e
          this.connection._purge = true
          this.connection.release()
          this.connection = null
          end()
        })
      } else {
        process.nextTick(end)
      }
    }

    q (ops) {
      ops.cb = ops.cb || ops.callback
      if (!ops.cb) {
        return new Promise((resolve, reject) => {
          ops.cb = (err, data) => {
            if (err) return reject(err)
            resolve(data)
          }
          this._doQuery(ops)
        })
      }
      this._doQuery(ops)
    }

    _doQuery (ops) {
      if (this.log) {
        this.logs.push(ops)
      }
      this.lastOps = ops
      ops.values = ops.values || ops.params || []
      ops.sql = ops.sql || ops.q
      const query = () => {
        /*
                 *This is crude and doesn't support complex queries i.e. UPDATE .... SELECT
                 *But it does the job for most cases
                 */
        if (this.gatherStats) {
          for (const stat of Object.keys(this.stats)) {
            if (ops.sql.toLowerCase().indexOf(stat) !== -1) {
              this.stats[stat] += 1
            }
          }
        }
        let streamError = null
        if (ops.lock != null) {
          ops.sql += ops.lock === 1 ? ' LOCK IN SHARE MODE' : ' FOR UPDATE'
        }
        if (!ops.retry) { this.queries.push({ q: ops.q, params: ops.params }) }
        if (ops.stream != null) {
          const streamQuery = this.lastQuery = this.connection.query(ops.sql, ops.params)
          streamQuery.on('error', function (err) { streamError = err })
          streamQuery.on('result', row => ops.stream(row))
          streamQuery.on('end', () => {
            if (streamError) { return this.error(streamError, ops.cb) }
            ops.cb()
          })
        } else {
          this.lastQuery = this.connection.query(ops, (err, data) => {
            if (err) {
              this.error(err, ops.cb)
            } else if (ops.warningsAreErrors && data && data.warningCount > 0) {
              this.connection.query('SHOW WARNINGS', (err, warnings) => {
                if (err) {
                  this.error(err, ops.cb)
                } else {
                  const error = new Error('Warnings treated as errors ' +
                                        data.warningCount)
                  error.warnings = warnings
                  this.error(error, ops.cb)
                }
              })
            } else {
              ops.cb(null, data)
            }
          })
        }
      }
      const run = () => {
        if (!this.hasTransaction && (this.autoStartTransaction || ops.lock)) {
          this.begin(function (err) {
            if (err) return ops.cb(err)
            query()
          })
        } else {
          query()
        }
      }
      if (this.connection == null) {
        this.connect(function (err) {
          if (err) return ops.cb(err)
          run()
        })
      } else {
        run()
      }
    }

    row (ops) {
      ops.cb = ops.cb || ops.callback
      if (ops.cb) {
        const cb = ops.cb
        ops.cb = (err, data) => {
          cb(err, data ? data[0] : null)
        }
        this.q(ops)
        return
      }

      return new Promise((resolve, reject) => {
        this.q(ops).then((data) => {
          resolve(data ? data[0] : null)
        }).catch((err) => reject(err))
      })
    }

    count (ops) {
      ops.cb = ops.cb || ops.callback
      if (ops.cb) {
        const cb = ops.cb
        ops.cb = (err, data) => {
          if (!data || !data[0]) {
            return cb(err, null)
          }
          cb(err, data[0][Object.keys(data[0])[0]])
        }
        this.q(ops)
        return
      }

      return new Promise((resolve, reject) => {
        this.q(ops).then((data) => {
          if (!data || !data[0]) {
            return resolve()
          }
          resolve(data[0][Object.keys(data[0])[0]])
        }).catch((err) => reject(err))
      })
    }

    begin (cb) {
      this.hasTransaction = true
      return this.q({
        q: 'START TRANSACTION',
        cb
      })
    }

    async commit (ops, cb) {
      if (typeof ops === 'function') {
        cb = ops
      }
      ops = ops || {}
      try {
        const data = await this.q({
          q: 'COMMIT',
          timeout: ops.timeout
        })
        this.hasTransaction = false
        if (cb) return cb(null, data)
        return data
      } catch (e) {
        if (cb) return cb(e)
        throw e
      }
    }

    end (ops, cb) {
      if (typeof ops === 'function') {
        cb = ops
        ops = {}
      }

      ops = ops || {}

      return new Promise((resolve, reject) => {
        if ((this.connection == null)) {
          const index = pool._connectionQueue.indexOf(this._returnConnection)
          if (index !== -1) {
            pool._connectionQueue.splice(index, 1)
          }
          this._reset()
          if (cb) process.nextTick(cb)
          resolve()
        } else if (this.hasTransaction) {
          return this.commit(ops, err => {
            this.connection.release()
            this._reset()
            if (cb) cb(err)
            if (err) return reject(err)
            resolve()
          })
        } else {
          this.connection.release()
          this._reset()
          if (cb) process.nextTick(cb)
          resolve()
        }
      })
    }

    _doBatch (queries, cb) {
      if (queries.length === 0) { return this.error(new Error('Cannot batch 0 queries'), cb) }
      const results = []
      let executed = 1
      const run = (err, res) => {
        results.push(res)
        if (err) { return cb(err, results) }
        if (queries.length > executed) {
          queries[executed].cb = run
          this.q(queries[executed])
          executed += 1
        } else {
          cb(null, results)
        }
      }

      queries[0].cb = run
      this.q(queries[0])
    }

    batch (queries, cb) {
      if (cb) return this._doBatch(queries, cb)
      return new Promise((resolve, reject) => {
        this._doBatch(queries, (err, data) => {
          if (err) return reject(err)
          return resolve(data)
        })
      })
    }
  }

  return {
    pool,
    connection: Connection,
    Connection: Connection
  }
}
