mysql = require 'mysql'
events = require 'events'
deprecate =  require('depd')('mysql-abstraction')

module.exports = (settings) ->
    pool = mysql.createPool settings

    pool: pool
    connection: class Connection extends events.EventEmitter
        constructor: (@autoStartTransaction = false) ->
            @hasTransaction = false
            @connection = null
            @log = false
            @logs = []
                
        _reset: ->
            @hasTransaction = false
            @connection = null
            @logs = []
            @_returnConnection = null
                
        connect: (cb) ->
            @_returnConnection = (err, connection) =>
                @connection = connection
                @lastQuery = null
                if err then @emit 'error', err
                cb(err)
            pool.getConnection @_returnConnection
            
        error: (err, cb) ->
            err.query = @lastQuery
            if settings.logErrors?
                settings.logErrors err
            end = =>
                @emit 'error', err
                cb err if cb?
            if @connection
                @connection.query 'ROLLBACK', (err) =>
                    @connection._purge = true
                    @connection.release()
                    @connection = null
                    end()
            else
                process.nextTick end
                
            
        q: (ops) ->
            if @log
                @logs.push ops
            query = =>
                ops.cb = ops.cb or ops.callback
                ops.values = ops.values or ops.params or []
                ops.sql = ops.sql or ops.q
                streamError = null
                if ops.lock?
                    ops.q += if ops.lock is 1 then ' LOCK IN SHARE MODE' else ' FOR UPDATE'
                if ops.stream?
                    @lastQuery = query = @connection.query ops.q, ops.params
                    query.on 'error', (err) ->
                        streamError = err
                    query.on 'result', (row) ->
                        ops.stream row
                    query.on 'end', =>
                        if streamError? then return @error streamError, ops.cb
                        ops.cb()
                else
                    @lastQuery = @connection.query ops, (err, data) =>
                        if err
                            @error err, ops.cb
                        else
                            ops.cb null, data
            run = =>
                if not @hasTransaction and (@autoStartTransaction or ops.lock?)
                    @begin ->
                        query()
                else
                    query()
            unless @connection?
                @connect ->
                    run()
            else
                run()
        
        row: (ops) ->
            cb = ops.cb
            [ cb, ops.cb ] = [ ops.cb, (err, data) -> cb err, data[0] ]
            @q ops
            
        count: (ops) ->
            cb = ops.cb
            [ cb, ops.cb ] = [ ops.cb, (err, data) -> cb err, data[0][Object.keys(data[0])[0]] ]
            @q ops
        
        begin: (cb) ->
            @hasTransaction = true
            @q q: 'START TRANSACTION', cb: ->
                cb()
            
        commit: (ops, cb) ->
            unless cb? then [cb, ops] = [ops, {}]
            @q q: 'COMMIT', timeout: ops.timeout, cb: =>
                @hasTransaction = false
                cb()
            
        end: (ops, cb) ->
            if arguments.length is 1
                cb = ops
                ops = {}
            if not @connection?
                index = pool._connectionQueue.indexOf @_returnConnection
                if index isnt -1
                    pool._connectionQueue.splice index, 1
                @_reset()
                process.nextTick cb
            else if @hasTransaction
                @commit ops, (err) =>
                    @connection.release()
                    @_reset()
                    cb(err)
            else
                @connection.release()
                @_reset()

                process.nextTick cb
                
        batch: (queries, cb) ->
            return @error new Error("Cannot batch 0 queries"), cb if queries.length is 0
            results = []
            executed = 1
            run = (err, res) =>
                results.push res
                return cb err, results if err
                if queries.length > executed
                    queries[executed].cb = run
                    @q queries[executed]
                    executed += 1
                else
                    cb null, results
            
            queries[0].cb = run
            @q queries[0]
            
