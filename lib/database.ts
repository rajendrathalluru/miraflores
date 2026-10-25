import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Local SQL adapter. Its deliberately small interface also fits an asynchronous
 * PostgreSQL repository, while the domain reducer remains database-independent. */
export class LocalDatabase {
  private connection: DatabaseSync;
  constructor(directory = process.env.MIRAFLORES_DATA_DIR || path.join(process.cwd(), '.local')) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.connection = new DatabaseSync(path.join(directory, 'workpaper.sqlite'));
    this.connection.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    this.connection.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const migrations = path.join(process.cwd(), 'drizzle');
    for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
      this.connection.exec('BEGIN IMMEDIATE');
      try {
        if (!this.connection.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file)) {
          this.connection.exec(readFileSync(path.join(migrations, file), 'utf8'));
          this.connection.prepare('INSERT INTO local_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
        }
        this.connection.exec('COMMIT');
      } catch (error) { this.connection.exec('ROLLBACK'); throw error; }
    }
  }
  prepare(sql: string) {
    const connection = this.connection;
    const withArgs = (args: SQLInputValue[]) => ({
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        return (connection.prepare(sql).get(...args) as T | undefined) || null;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
        return { results: connection.prepare(sql).all(...args) as T[] };
      },
      async run(): Promise<{ meta: { changes: number } }> {
        const result = connection.prepare(sql).run(...args);
        return { meta: { changes: Number(result.changes) } };
      },
    });
    return { ...withArgs([]), bind: (...args: SQLInputValue[]) => withArgs(args) };
  }
  close() { this.connection.close(); }
}

let current: LocalDatabase | undefined;
export function getLocalDatabase() { return current ??= new LocalDatabase(); }
