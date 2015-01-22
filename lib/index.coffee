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
            if @listeners('queue').length
                deprecate("The 'queue' event for 'connection' is deprecated, please listen to the
                          'enqueue' event of 'pool', to obtain the queue length use
                          'pool._connectionQueue.length'")
                process.nextTick =>
                    if pool._connectionQueue.length
                        @emit 'queue', pool._connectionQueue.length
            @_returnConnection = (err, connection) =>
                @connection = connection
                @lastQuery = null
                if err then @emit 'error', err
                cb(err)
            pool.getConnection @_returnConnection
            
        error: (err, cb) ->
            if settings.logErrors?
                err.query = @lastQuery
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
                ops.params = ops.params or []
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
                    @lastQuery = @connection.query ops.q, ops.params, (err, data) =>
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
            
        commit: (cb) ->
            @q q: 'COMMIT', cb: =>
                @hasTransaction = false
                cb()
            
        end: (cb) ->
            if not @connection?
                index = pool._connectionQueue.indexOf @_returnConnection
                if index isnt -1
                    pool._connectionQueue.splice index, 1
                @_reset()
                if cb? then process.nextTick cb
            else if @hasTransaction
                @q q: 'COMMIT', cb: (err) =>
                    @connection.release()
                    @_reset()
                    cb(err) if cb?
            else
                @connection.release()
                @_reset()

                process.nextTick cb if cb?
                
        batch: (queries, cb) ->
            return @error "Cannot batch 0 queries", cb if queries.length is 0
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
            
