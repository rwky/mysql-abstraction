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
```