import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePacket, digest } from './packet';
import { emptyState, actors } from './workflow';
import type { Packet, WorkState, Row } from './types';
type Tx = { query: (sql: string, params?: any[]) => Promise<{ rows: Row[] }> };
type Database = Tx & { transaction: <T>(cb: (tx: Tx) => Promise<T>) => Promise<T> };
const g = globalThis as typeof globalThis & { __workpaperDB?: Promise<Database> };
const schema = `
CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS engagements(id TEXT PRIMARY KEY,client_id TEXT REFERENCES clients(id),tax_year INT NOT NULL,packet_hash TEXT NOT NULL,raw_packet JSONB NOT NULL,revision INT NOT NULL DEFAULT 0,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workpaper_adjustments(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),target_key TEXT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS review_records(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),kind TEXT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),revision INT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS command_receipts(engagement_id TEXT NOT NULL,request_id TEXT NOT NULL,actor_id TEXT NOT NULL,fingerprint TEXT NOT NULL,revision INT NOT NULL,PRIMARY KEY(engagement_id,request_id));
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),name TEXT NOT NULL,mime TEXT NOT NULL,content_hash TEXT NOT NULL,data_base64 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS records_engagement ON review_records(engagement_id,kind);
`;
export function dataDirectory() {
  return path.resolve(/* turbopackIgnore: true */ process.env.WORKPAPER_DATA_DIR || '.local');
}
export async function db(): Promise<Database> {
  if (!g.__workpaperDB)
    g.__workpaperDB = (async () => {
      let database: Database;
      if (process.env.DATABASE_URL) {
        const sql = postgres(process.env.DATABASE_URL, {
          max: 5,
          prepare: false,
          connect_timeout: 10,
          connection: { search_path: 'miraflores' },
          types: {
            json: {
              to: 114,
              from: [114, 3802],
              serialize: (value: any) =>
                typeof value === 'string' ? value : JSON.stringify(value),
              parse: JSON.parse,
            },
          },
        });
        const wrap = (s: any): Tx => ({
          query: async (q, p = []) => ({ rows: await s.unsafe(q, p) }),
        });
        database = {
          ...wrap(sql),
          transaction: (cb) => sql.begin(async (s) => cb(wrap(s))) as any,
        };
        await database.query('CREATE SCHEMA IF NOT EXISTS miraflores');
        await database.query('REVOKE ALL ON SCHEMA miraflores FROM PUBLIC');
        for (const statement of schema.split(';').filter((x) => x.trim()))
          await database.query(statement);
      } else {
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
          throw new Error(
            'DATABASE_URL is not configured for this deployment. Set the Supabase session-pooler connection string in your hosting environment, then redeploy. Local database storage is unavailable on serverless hosting.',
          );
        }
        await mkdir(dataDirectory(), { recursive: true, mode: 0o700 });
        const pg = new PGlite(path.join(dataDirectory(), 'postgres'));
        await pg.waitReady;
        await pg.exec(schema);
        database = {
          query: (q, p = []) => pg.query(q, p),
          transaction: (cb) => pg.transaction((tx) => cb(tx as Tx)),
        };
      }
      const existing = await database.query('SELECT id FROM engagements LIMIT 1');
      if (!existing.rows.length) {
        const packet = JSON.parse(
          await readFile(path.join(process.cwd(), 'data/seed-packet.json'), 'utf8'),
        );
        await importPacket(database, packet);
      }
      return database;
    })();
  return g.__workpaperDB;
}
export function clientName(p: Packet) {
  const people = (p.household.people || []).filter((x: Row) =>
    ['taxpayer', 'spouse'].includes(x.role),
  );
  return people.map((x: Row) => x.name).join(' & ') || String(p.packet.client_id);
}
export async function importPacket(database: Database, p: Packet) {
  validatePacket(p);
  const hash = digest(p),
    id = `${p.packet.client_id}-${p.household.tax_year}-${hash.slice(0, 10)}`;
  await database.transaction(async (tx) => {
    await tx.query(
      'INSERT INTO clients(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
      [p.packet.client_id, clientName(p)],
    );
    await tx.query(
      'INSERT INTO engagements(id,client_id,tax_year,packet_hash,raw_packet,state) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) ON CONFLICT(id) DO NOTHING',
      [
        id,
        p.packet.client_id,
        p.household.tax_year,
        hash,
        JSON.stringify(p),
        JSON.stringify(emptyState(p)),
      ],
    );
  });
  return id;
}
export async function load(id?: string) {
  const database = await db();
  const { rows } = id
    ? await database.query('SELECT * FROM engagements WHERE id=$1', [id])
    : await database.query('SELECT * FROM engagements ORDER BY created_at ASC LIMIT 1');
  if (!rows[0]) throw new Error('Engagement not found.');
  return {
    database,
    row: rows[0],
    packet: rows[0].raw_packet as Packet,
    state: rows[0].state as WorkState,
  };
}
export async function listEngagements() {
  const database = await db();
  return (
    await database.query(
      'SELECT e.id,e.client_id,e.tax_year,e.revision,e.packet_hash,c.name FROM engagements e JOIN clients c ON c.id=e.client_id ORDER BY e.created_at ASC',
    )
  ).rows;
}
export async function persist(tx: Tx, id: string, previous: number, s: WorkState) {
  const result = await tx.query(
    'UPDATE engagements SET state=$1::jsonb,revision=$2 WHERE id=$3 AND revision=$4 RETURNING id',
    [JSON.stringify(s), s.revision, id, previous],
  );
  if (!result.rows.length)
    throw Object.assign(
      new Error('Another reviewer saved first. Refresh and review your draft before retrying.'),
      { status: 409 },
    );
  for (const a of s.adjustments)
    await tx.query(
      'INSERT INTO workpaper_adjustments(id,engagement_id,target_key,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
      [a.id, id, a.target, JSON.stringify(a)],
    );
  const last = s.audit.at(-1)!;
  await tx.query(
    'INSERT INTO audit_events(id,engagement_id,revision,payload) VALUES($1,$2,$3,$4::jsonb)',
    [last.id, id, s.revision, JSON.stringify(last)],
  );
  for (const kind of [
    'threads',
    'judgments',
    'tasks',
    'evidence',
    'signoffs',
    'plans',
    'times',
    'outside',
    'links',
  ])
    for (const r of (s as any)[kind] || [])
      await tx.query(
        'INSERT INTO review_records(id,engagement_id,kind,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
        [r.id, id, kind, JSON.stringify(r)],
      );
}
