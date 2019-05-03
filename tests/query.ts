import * as assert from 'assert';
import Connection, {MysqlError} from '../lib/index';
import {suite, suiteSetup} from 'mocha';

const config = {
	user: process.env.MYSQL_USER || 'root',
	host: process.env.MYSQL_HOST || '127.0.0.1',
	password: process.env.MYSQL_PASSWORD || 'root',
	connectionLimit: 10,
	database: 'mysql',
	port: process.env.MYSQL_PORT || 3307
};

suite('Query', function() {
	suiteSetup(async function() {
		const q = new Connection(config);
		await q.row({sql: 'SET GLOBAL max_connections = 10'});
		await q.row({sql: 'CREATE DATABASE IF NOT EXISTS test'});
		await q.row({sql: `CREATE TABLE IF NOT EXISTS test.innodb_deadlock_maker(a INT PRIMARY KEY) ENGINE=innodb`});
		await q.row({sql: 'CREATE TABLE IF NOT EXISTS test.lockTest (test varchar(30))'});
		await q.row({sql: 'TRUNCATE TABLE test.lockTest'});
		await q.row({sql: 'INSERT INTO test.lockTest VALUES ("test")'});
		await q.end();
		console.log('ok');
	});

	test('select', async function() {
		const q = new Connection(config);
		try {
			for await(const data of q.q({sql: 'SELECT 1 AS k'})) {
				assert.equal(data.k, 1);
			}
		} finally {
			await q.end();
		}
	});

	test('select-values', async function() {
		const q = new Connection(config);
		try {
			for await(const data of q.q({sql: 'SELECT ? AS k', values: [1]}))
				assert.equal(data.k, 1);
		} finally {
			await q.end();
		}
	});

	test('lock1', async function() {
		const q = new Connection(config);
		try {
			for await(const data of q.q({sql: 'SELECT 1 AS k', lock: 1}))
				assert.equal(data.k, 1);
		} finally {
			await q.end();
		}
	});

	test('lock2', async function() {
		const q = new Connection(config);
		try {
			for await(const data of q.q({sql: 'SELECT 1 AS k', lock: 2}))
				assert.equal(data.k, 1);
		} finally {
			await q.end();
		}
	});

	test('lock-functions', async function() {
		const q = new Connection(config, true);
		const q2 = new Connection(config, true);
		try {
			let data = await q.row({sql: 'SELECT * FROM test.lockTest', lock: 2});
			assert.equal(data.test, 'test');
			const data2 = q2.row({sql: 'SELECT * FROM test.lockTest', lock: 2});
			await q.row({sql: 'UPDATE test.lockTest SET test="test2"'});
			await q.commit();
			assert.equal((await data2).test, 'test2');
		} finally {
			await q.end();
			q2.end();
		}
	});

	test('end', async function() {
		const q = new Connection(config);
		try {
			for await(const data of q.q({sql: 'SELECT 1 AS k'}))
				assert.equal(data.k, 1);
			await await q.end();
		} finally {
			await await q.end();
		}
	});

	test('commit', async function() {
		const q = new Connection(config);
		try {
			await q.begin();
			for await(const data of q.q({sql: 'SELECT 1 AS k'}))
				assert.equal(data.k, 1);
			await q.commit();
		} finally {
			await q.end();
		}
	});

	test('timeout', async function() {
		const q = new Connection(config);
		try {
			q.on('error', () => {
			});
			await q.begin();
			await assert.rejects(q.row({sql: 'SELECT SLEEP(10)', timeout: 1}), (err: MysqlError) => err.code === 'PROTOCOL_SEQUENCE_TIMEOUT');
		} finally {
			await q.end();
		}
	});

	test('error', async function() {
		const q = new Connection(config);
		try {
			q.on('error', () => {
			});
			await q.begin();
			await assert.rejects(q.row({sql: 'SELECT 1 AS k FROM no_table'}), (err: MysqlError) => err.code === 'ER_NO_SUCH_TABLE');
		} finally {
			await q.end();
		}
	});

	test('batch', async function() {
		const q = new Connection(config);
		try {
			let i = 1;
			for await(const query of q.batch({sql: 'SELECT 1 AS k'}, {sql: 'SELECT 2 AS k'}))
				for await(const data of query)
					assert.equal(data.k, i++);
		} finally {
			await q.end();
		}
	});

	test('batcherror', async function() {
		const q = new Connection(config);
		try {
			q.on('error', () => {
			});
			for await(const query of q.batch({sql: 'SELECT 1 AS k FROM no_table'}))
				await assert.rejects(query[Symbol.asyncIterator]().next(), (err: MysqlError) => err.code === 'ER_NO_SUCH_TABLE');
		} finally {
			await q.end();
		}
	});

	test('logs', async function() {
		const q = new Connection(config);
		try {
			q.log = true;
			await q.row({sql: 'SELECT 1 AS k'});
			assert.equal(q.logs[0].sql, 'SELECT 1 AS k');
		} finally {
			await q.end();
		}
	});

	test('row', async function() {
		const q = new Connection(config);
		try {
			q.log = true;
			const data = await q.row({sql: 'SELECT 1 AS k'});
			assert.equal(data.k, 1);
		} finally {
			await q.end();
		}
	});

	test('count', async function() {
		const q = new Connection(config);
		try {
			q.log = true;
			const data = await q.count({sql: 'SELECT count(*)'});
			assert.equal(data, 1);
		} finally {
			await q.end();
		}
	});

	test('warningsAreErrors', async function() {
		const q = new Connection(config);
		q.on('error', () => {
		});
		try {
			await q.row({sql: 'CREATE TEMPORARY TABLE warnings_test (test_col VARCHAR(5));'});
			await assert.rejects(q.row({sql: 'INSERT INTO warnings_test SET test_col="123456"', warningsAreErrors: true}), (err: MysqlError) =>
				err.message === 'Warnings treated as errors 1' && err.warnings![0].Message === 'Data truncated for column \'test_col\' at row 1');
		} finally {
			await q.end();
		}
	});

	test('warningsAreErrorsNotEnabled', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'CREATE TEMPORARY TABLE warnings_test (test_col VARCHAR(5));'});
			await q.row({sql: 'INSERT INTO warnings_test SET test_col="123456"'});
		} finally {
			await q.end();
		}
	});

	/*test('deadlocks', async function() {
		const q = new Connection(config, true), q2 = new Connection(config, true);
		try {
			let deadlocks = 0;
			q2.on('deadlock', () => deadlocks += 1);
			await q.row({sql: 'SET autocommit=0'});
			await q2.row({sql: 'SET autocommit=0'});
			await q.row({sql: 'INSERT INTO test.innodb_deadlock_maker VALUES(1)'});
			await q2.row({sql: 'SELECT * FROM test.innodb_deadlock_maker FOR UPDATE'});
			await q.row({sql: 'INSERT INTO test.innodb_deadlock_maker VALUES(0);'});
			assert.equal(deadlocks, 1);
		} finally {
			await q.end();
			q2.end();
		}
	});*/

	test('statsSelect', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'SELECT 1'});
			assert.equal(q.stats.select, 1);
		} finally {
			await q.end();
		}
	});

	test('statsInsert', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'INSERT INTO test.lockTest VALUES("insert")'});
			assert.equal(q.stats.insert, 1);
		} finally {
			await q.end();
		}
	});

	test('statsUpdate', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'UPDATE test.lockTest SET test="update"'});
			assert.equal(q.stats.update, 1);
		} finally {
			await q.end();
		}
	});

	test('statsDelete', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'DELETE FROM test.lockTest'});
			assert.equal(q.stats.delete, 1);
		} finally {
			await q.end();
		}
	});

	test('statsSelectDisabled', async function() {
		const q = new Connection(config);
		try {
			q.gatherStats = false;
			await q.row({sql: 'SELECT 1'});
			assert.equal(q.stats.select, 0);
		} finally {
			await q.end();
		}
	});

	test('testNoReconnect', async function() {
		const q = new Connection(config);
		try {
			await q.row({sql: 'SELECT 1'});
			assert.equal(q.connectionAttempts, 1);
		} finally {
			await q.end();
		}
	});

	test('testReconnect', async function() {
		const connections: Connection[] = [];
		try {
			//max connections are 10 and cannot be changed below that value in mariadb
			for(var i = 0; i < 10; ++i) {
				const q = new Connection(config);
				connections.push(q);
				await q.count({sql: 'SELECT 1'});
			}
			const q = new Connection(config);
			q.on('error', () => {
			});
			connections.push(q);
			setTimeout(() => connections[0].end(), 300);
			await q.count({sql: 'SELECT 1'});
			assert.equal(q.connectionAttempts, 2);
		} finally {
			for(const connection of connections)
				await connection.end();
		}
	});

	return test('testFailedReconnect', async function() {
		const connections: Connection[] = [];
		try {
			//max connections are 10 and cannot be changed below that value in mariadb
			for(var i = 0; i < 10; ++i) {
				const q = new Connection(config);
				connections.push(q);
				await q.count({sql: 'SELECT 1'});
			}
			const q = new Connection(config);
			q.on('error', () => {
			});
			await assert.rejects(q.count({sql: 'SELECT 1'}), (err: MysqlError) => err.code === 'ER_CON_COUNT_ERROR');
			assert.equal(q.connectionAttempts, 4);
		} finally {
			for(const connection of connections)
				await connection.end();
		}
	});
});
