[![Build Status](https://app.travis-ci.com/rwky/mysql-abstraction.svg?branch=master)](https://app.travis-ci.com/rwky/mysql-abstraction)
[![Coverage Status](https://coveralls.io/repos/github/rwky/mysql-abstraction/badge.svg?branch=master)](https://coveralls.io/github/rwky/mysql-abstraction?branch=master)

This is an abstraction layer built on https://github.com/felixge/node-mysql it add's various helper methods, helps deal with transactions and supports promises.

Example usage:
```js
var Connection, mysql, q;

mysql = require('mysql-abstraction')({
  user: process.env.MYSQL_USER,
  host: process.env.MYSQL_HOST,
  password: process.env.MYSQL_PASSWORD,
  connectionLimit: 100
});

//select then update using a transaction
q = new mysql.Connection(true);
q.q({ q:'SELECT something FROM table WHERE id=?',params:[1],lock:1,cb: function(err,data){
    //do something with data
    q.q( { q:'UPDATE table SET something=? WHERE id=?',params:['something else',1],function(){
        q.end()
    }})
} })

//count the number of rows
q = new mysql.Connection();
q.count({ q:'SELECT count(*) FROM table',cb: function(err,data){
    //do something with data
    console.log(data);
} })

//fetch the first row
q = new mysql.Connection();
q.row({ q:'SELECT something FROM table WHERE id=1',cb: function(err,data){
    //do something with data
    console.log(data);
} })

// using promises
q = new mysql.Connection();
q.count({ q:'SELECT count(*) FROM table' }).then((data) => {
    // do something with data
}).catch((err) => {
    // do something with error
})

// using async/await

async function getCount() {
    try {
        q = new mysql.Connection();
        const data = await q.count({ q:'SELECT count(*) FROM table' })
        // do something with data
    } catch (err) {
        // do something with err
    }
}

getCount()


```

See tests/ for more usage examples

Note when deadlocks are automatically rolled back and queries are reissued any autoincrement columns aren't reverted, see http://stackoverflow.com/questions/14758625/mysql-auto-increment-columns-on-transaction-commit-and-rollback for more details

There is a crude stats collection via the connection.stats prameter which counts the number of select/update/delete/insert queries per connection, you can disable stats collection by setting connection.gatherStats to false
