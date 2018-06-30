[![Build Status](https://travis-ci.org/rwky/mysql-abstraction.svg?branch=master)](https://travis-ci.org/rwky/mysql-abstraction)
[![Coverage Status](https://coveralls.io/repos/github/rwky/mysql-abstraction/badge.svg?branch=master)](https://coveralls.io/github/rwky/mysql-abstraction?branch=master)
[![Dependencies](https://david-dm.org/rwky/mysql-abstraction.png)](https://david-dm.org/rwky/mysql-abstraction)
<!--[![SAST](https://gitlab.com/rwky/mysql-abstraction-strategy/badges/master/build.svg)](https://gitlab.com/rwky/mysql-abstraction-strategy/badges/master/build.svg)-->

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

There is a crude stats collection via the connection.stats prameter which counts the number of select/update/delete/insert queries per connection, you can disable stats collection by setting connection.gatherStats to false


# LICENSE

	mysql-abstraction an abstraction layer on top of node-mysql
    Copyright (C) 2014 Rowan Wookey <admin@rwky.net>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

