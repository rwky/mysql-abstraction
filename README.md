[![Dependency Status](https://gemnasium.com/rwky/mysql-abstraction.svg)](https://gemnasium.com/rwky/mysql-abstraction) [![NPM Version](https://img.shields.io/npm/v/mysql-abstraction.svg?style=flat)](https://www.npmjs.org/package/mysql-abstraction)

This is an abstraction layer built on https://github.com/felixge/node-mysql it add's various helper methods and helps deal with transactions.

Example usage:
```js
var Connection, mysql, q;

mysql = require('mysql-abstraction')({
  user: process.env.MYSQL_USER,
  host: process.env.MYSQL_HOST,
  password: process.env.MYSQL_PASSWORD,
  connectionLimit: 100
});

Connection = mysql.connection;

//select then update using a transaction
q = new Connection(true);
q.q({ q:'SELECT something FROM table WHERE id=?',params:[1],lock:1,cb: function(err,data){
    //do something with data
    q.q( { q:'UPDATE table SET something=? WHERE id=?',params:['something else',1],function(){
        q.end()
    }})
} })

//count the number of rows
q = new Connection();
q.count({ q:'SELECT count(*) FROM table',cb: function(err,data){
    //do something with data
    console.log(data);
} })

//fetch the first row
q = new Connection();
q.row({ q:'SELECT something FROM table WHERE id=1',cb: function(err,data){
    //do something with data
    console.log(data);
} })

```

See tests/query.coffee for more usage examples

Note when deadlocks are automatically rolled back and queries are reissued any autoincrement columns aren't reverted, see http://stackoverflow.com/questions/14758625/mysql-auto-increment-columns-on-transaction-commit-and-rollback for more details
