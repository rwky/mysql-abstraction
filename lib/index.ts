process.env.READABLE_STREAM = 'disable';
import {EventEmitter} from 'events';
import * as mysql from 'mysql';
import {promisify} from 'util';

type Settings = {user: string, host: string, password: string, connectionLimit: number, logErrors?: (error: Error) => {}};
type Options = {values?: (string | number)[], sql: string, lock?: number, retry?: boolean, timeout?: number, warningsAreErrors?: boolean};
type Stats = {select: number, update: number, delete: number, insert: number}
export type MysqlError = Error & {query?: mysql.Query, code?: string, fatal: boolean, warnings?: {Message: string}[]};

export default class Connection extends EventEmitter {
	gatherStats = true;
	log = false;
	logs: Options[] = [];
	maxRetries = 3;
	connectionRetries = 4;
	connectionRetryInterval = 500;
	hasTransaction = false;
	queries: Options[] = [];
	connection?: mysql.Connection;
	connectionAttempts = 0;
	lastQuery?: mysql.Query;
	lastOps?: Options;
	stats!: Stats;

	constructor(private settings: Settings, private autoStartTransaction = false) {
		super();
		this._reset();
	}

	private _reset() {
		this.hasTransaction = false;
		this.connection = undefined;
		this.logs = [];
		this.connectionAttempts = 0;
		this.lastQuery = undefined;
		this.lastOps = undefined;
		return this.stats = {select: 0, update: 0, delete: 0, insert: 0};
	}

	async connect() {
		this.connectionAttempts += 1;
		try {
			this.connection = mysql.createConnection(this.settings);
			await promisify(this.connection.connect.bind(this.connection))();
		} catch(error) {
			if(this.connectionAttempts >= this.connectionRetries) {
				this.emit('error', error);
				throw error;
			} else {
				await new Promise<void>((resolve, reject) => {
					setTimeout(() => this.connect().then(resolve, reject), this.connectionRetryInterval);
				});
			}
		}
	}

	private async error(ops: Options, retries: number, err: MysqlError) {
		//deadlock, reissue query
		err.query = this.lastQuery;
		if(this.settings.logErrors)
			this.settings.logErrors(err);

		if((err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT') && retries < this.maxRetries) {
			this.emit('deadlock', err);
			if(this.hasTransaction) {
				this.hasTransaction = false;
				await this.end();
				await this.begin();
				for await(const query of this.batch(...this.queries))
					for await(const _ of query) {}
			} else this.end();
			return this.query(ops, retries);
		}
		if(this.connection && this.hasTransaction && !err.fatal) {
			this.connection.query('ROLLBACK', err => {
				this.hasTransaction = false;
				this.queries = [];
				this.emit('error', err);
			});
		} else {
			this.hasTransaction = false;
			if(err.fatal) this._reset();
			else await this.end();
			process.nextTick(() => this.emit('error', err));
		}
		throw err;
	}

	private async* query(ops: Options, retries: number): AsyncIterable<any> {
		if(this.log)
			this.logs.push(ops);
		this.lastOps = ops;
		if(!this.connection)
			await this.connect();
		if(!this.hasTransaction && (this.autoStartTransaction || (ops.lock)))
			await this.begin();
		/*
		 *This is crude and doesn't support complex queries i.e. UPDATE .... SELECT
		 *But it does the job for most cases
		*/
		if(this.gatherStats) {
			for(let stat of Object.keys(this.stats)) {
				if(ops.sql.toLowerCase().indexOf(stat) !== -1)
					this.stats[<keyof Stats>stat] += 1;
			}
		}
		if(ops.lock)
			ops.sql += ops.lock === 1 ? ' LOCK IN SHARE MODE' : ' FOR UPDATE';
		const query = this.lastQuery = this.connection!.query(ops);
		try {
			for await(const data of query.stream()) {
				if(ops.warningsAreErrors && data.warningCount) {
					await new Promise((_, reject) => {
						this.connection!.query('SHOW WARNINGS', (e: Error, warnings: string[]) => {
							if(e) return reject(e);
							const error = new Error('Warnings treated as errors ' + data.warningCount);
							(<Error & {warnings: string[]}>error).warnings = warnings;
							reject(error);
						});
					});
				}
				yield data;
			}
		} catch(err) {
			return this.error(ops, retries, err);
		}
		this.queries.push(ops);
	}


	q(ops: Options): AsyncIterable<any> {
		return this.query(ops, 1);
	}

	async row(ops: Options) {
		for await(const row of this.q(ops))
			return row;
	}

	async count(ops: Options) {
		return Object.values(await this.row(ops))[0];
	}

	async begin() {
		this.hasTransaction = true;
		this.queries = [];
		return this.row({sql: 'START TRANSACTION'});
	}

	async commit() {
		await this.row({sql: 'COMMIT'});
		this.hasTransaction = false;
		this.queries = [];
	}

	async end() {
		if(this.hasTransaction)
			await this.commit();
		if(!this.connection) return;
		await promisify(this.connection.end.bind(this.connection))();
		this._reset();
	}

	async* batch(...queries: Options[]) {
		for(const query of queries)
			yield this.q(query);
	}
}