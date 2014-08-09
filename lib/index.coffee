mysql = require 'mysql'
events = require 'events'

module.exports = (settings)->
        pool = mysql.createPool settings
    
        pool:pool
        connection: class Connection extends events.EventEmitter
            constructor: (@autoStartTransaction=false)->
                @hasTransaction = false
                @connection = null
                
            connect: (cb)->
                #Until https://github.com/felixge/node-mysql/pull/716 is merged in
                #this is a hack to find out if a connection is queued
                #I don't want to keep maintaining my own fork for a minor code change
                process.nextTick =>
                    if pool._connectionQueue.length
                        @emit 'queue',pool._connectionQueue.length
                
                pool.getConnection (err,connection)=>
                    @connection = connection
                    @lastQuery = null
                    if err then @emit 'error',err
                    cb(err)
                
            error: (err,cb)->
                if settings.logErrors?
                    err.query = @lastQuery
                    settings.logErrors err
                end = =>
                    @emit 'error',err
                    cb err if cb?
                if @connection
                    @connection.on 'error',->
                    @connection.query 'ROLLBACK',(err)=>
                        @connection._purge = true
                        @connection.release()
                        @connection = null
                        end()
                else
                    process.nextTick end
                    
                
            q: (ops)->
                
                query = ()=>
                    ops.cb = ops.cb || ops.callback || ->
                    ops.params = ops.params || []
                    streamError = null
                    if ops.lock?
                        ops.q+= if ops.lock is 1 then ' LOCK IN SHARE MODE' else ' FOR UPDATE'
                    if ops.stream?
                        @lastQuery = query = @connection.query ops.q,ops.params
                        query.on 'error',(err)->
                            streamError = err
                        query.on 'result',(row)->
                            ops.stream row
                        query.on 'end',()=>
                            if streamError? then return @error streamError,ops.cb
                            ops.cb()
                    else
                        @lastQuery = @connection.query ops.q,ops.params,(err,data)=>
                            if err
                                @error err,ops.cb
                            else
                                ops.cb null,data
                run = ()=>
                    if !@hasTransaction and (@autoStartTransaction or ops.lock?)
                        @begin ()->
                            query()
                    else
                        query()
                if !@connection?
                    @connect ()=>
                        run()
                else
                    run()
            
            begin: (cb)->
                @hasTransaction=true
                @q q:'START TRANSACTION',cb:()->
                    cb()
                
            commit: (cb)->
                @q q:'COMMIT',cb:()=>
                    @hasTransaction=false
                    cb()
                
            end: (cb)->
                if !@connection?
                    if cb? then process.nextTick cb
                    return
                if @hasTransaction
                    @q q:'COMMIT',cb:(err)=>
                        @connection.release()
                        @connection = null
                        cb(err) if cb?
                else
                    @connection.release()
                    @connection = null
                    process.nextTick cb if cb?
                    
            batch: (queries, cb) ->
                return @error "Cannot batch 0 queries",cb if queries.length is 0
                results = []
                executed = 1
                run = (err,res)=>
                    results.push res
                    return cb err,results if err
                    if queries.length > executed
                        queries[executed].cb = run
                        @q queries[executed]
                        executed+=1
                    else
                        cb null,results
                
                queries[0].cb = run
                @q queries[0]
                
