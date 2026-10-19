/**
 * Database access layer with two drivers:
 *
 *   • SQLite  — local development and single-file deployments (better-sqlite3)
 *   • Postgres — production (Neon, Supabase, Render Postgres, …)
 *
 * The driver is chosen from the environment:
 *
 *   DATABASE_URL=postgres://user:pass@host/db   → Postgres
 *   DATABASE_URL=pglite://memory                → embedded Postgres (tests)
 *   (unset)                                     → SQLite at DB_PATH / data/biopulse.db
 *
 * Route code is written once, with `?` placeholders and `await db.get/all/run`.
 * In Postgres mode the placeholders are rewritten to `$1…$n` automatically and
 * INSERTs get a `RETURNING id` so `lastInsertRowid` keeps working unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import pg from 'pg';

const require = createRequire(import.meta.url);

export type Row = Record<string, any>;
export type RunResult = { changes: number; lastInsertRowid: number | null };

export type DbKind = 'sqlite' | 'postgres';

interface Driver {
  kind: DbKind;
  describe(): string;
  all(sql: string, params: unknown[]): Promise<Row[]>;
  get(sql: string, params: unknown[]): Promise<Row | undefined>;
  run(sql: string, params: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------
function createSqliteDriver(): Driver {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(dataDir, 'biopulse.db');

  // One-time migration from the legacy root-level file so existing data survives.
  const legacyPath = path.resolve(process.cwd(), 'biopulse500.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath) && fs.statSync(legacyPath).size > 0) {
    for (const suffix of ['', '-wal', '-shm']) {
      const from = `${legacyPath}${suffix}`;
      if (fs.existsSync(from)) fs.copyFileSync(from, `${dbPath}${suffix}`);
    }
    console.log(`[db] migrated legacy database to ${dbPath}`);
  }

  const raw = new Database(dbPath);
  // TRUNCATE (not WAL) keeps every committed transaction inside the main .db
  // file. With WAL, a kill/restart can leave data sitting in -wal/-shm sidecar
  // files that are easily lost when the workspace is snapshotted.
  raw.pragma('journal_mode = TRUNCATE');
  raw.pragma('synchronous = FULL');
  raw.pragma('foreign_keys = ON');
  console.log(`[db] SQLite at ${dbPath}`);

  // Render/Railway/Fly containers are rebuilt from the repo on every deploy, and
  // free instances also sleep. A SQLite file inside that container is therefore
  // erased regularly — set DATABASE_URL to Postgres, or DB_PATH to a mounted disk.
  if (!process.env.DB_PATH && (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT)) {
    console.warn(
      '[db] WARNING: SQLite is stored inside the container (%s).\n' +
        '     This file is DELETED on every deploy/restart on %s.\n' +
        '     Set DATABASE_URL to a Postgres database, or mount a disk and set DB_PATH.',
      dbPath,
      process.env.RENDER ? 'Render' : 'Railway'
    );
  }

  // All SQLite work is serialised through one promise chain, so an async
  // transaction stays atomic even though better-sqlite3 is synchronous.
  let chain: Promise<unknown> = Promise.resolve();
  const inTransaction = new AsyncLocalStorage<boolean>();

  function serialize<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next as Promise<T>;
  }

  function direct<T>(fn: () => T): Promise<T> {
    return inTransaction.getStore() ? Promise.resolve(fn()) : serialize(fn);
  }

  return {
    kind: 'sqlite',
    describe: () => dbPath,
    all: (sql, params) => direct(() => raw.prepare(sql).all(...params) as Row[]),
    get: (sql, params) => direct(() => raw.prepare(sql).get(...params) as Row | undefined),
    run: (sql, params) =>
      direct(() => {
        const result = raw.prepare(sql).run(...params);
        return {
          changes: Number(result.changes),
          lastInsertRowid: Number(result.lastInsertRowid),
        };
      }),
    exec: (sql) =>
      direct(() => {
        raw.exec(sql);
      }),
    transaction: async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (inTransaction.getStore()) return fn();
      return serialize(async () => {
        raw.exec('BEGIN');
        try {
          const result = await inTransaction.run(true, fn);
          raw.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            raw.exec('ROLLBACK');
          } catch {
            /* already rolled back */
          }
          throw error;
        }
      });
    },
    close: async () => {
      raw.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

/** Rewrite `?` placeholders to `$1…$n`, leaving quoted text untouched. */
export function toPgPlaceholders(sql: string): string {
  let index = 0;
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '?') {
      out += `$${++index}`;
      continue;
    }
    out += ch;
  }
  return out;
}

type PgField = { name?: string; dataTypeID?: number };
type PgResult = { rows: Row[]; rowCount: number | null; fields?: PgField[] };
type Queryable = {
  query(text: string, params?: unknown[]): Promise<PgResult>;
};

// Postgres returns int8 (COUNT) and numeric (SUM/AVG) as strings; SQLite returns
// numbers. Normalise them so the API responds identically on both engines.
const NUMERIC_TYPE_IDS = new Set([20 /* int8 */, 1700 /* numeric */]);

function normalizeRows(result: PgResult): Row[] {
  const fields = result.fields;
  if (!fields || fields.length === 0) return result.rows;
  const numericColumns = fields
    .map((field, index) => (field.dataTypeID && NUMERIC_TYPE_IDS.has(field.dataTypeID) ? field.name ?? String(index) : null))
    .filter((name): name is string => Boolean(name));
  if (numericColumns.length === 0) return result.rows;

  for (const row of result.rows) {
    for (const column of numericColumns) {
      if (row[column] !== null && row[column] !== undefined) row[column] = Number(row[column]);
    }
  }
  return result.rows;
}

function createPgExecutor(kind: 'postgres' | 'pglite', connect: () => Promise<Queryable>): Driver {
  const clientStore = new AsyncLocalStorage<Queryable>();

  async function q(sql: string, params: unknown[]): Promise<PgResult> {
    const text = toPgPlaceholders(sql);
    const client = clientStore.getStore();
    if (client) {
      const result = await client.query(text, params);
      result.rows = normalizeRows(result);
      return result;
    }
    const transient = await connect();
    try {
      const result = await transient.query(text, params);
      result.rows = normalizeRows(result);
      return result;
    } finally {
      // PGlite has no release(); pools do.
      (transient as any).release?.();
    }
  }

  return {
    kind: 'postgres',
    describe: () => (kind === 'pglite' ? 'embedded Postgres (pglite)' : 'Postgres'),
    all: async (sql, params) => (await q(sql, params)).rows,
    get: async (sql, params) => {
      const res = await q(sql, params);
      return res.rows[0];
    },
    run: async (sql, params) => {
      const text = toPgPlaceholders(sql);
      const isInsert = /^\s*INSERT\s+/i.test(text) && !/\bRETURNING\b/i.test(text);
      const finalSql = isInsert ? `${text.replace(/;\s*$/, '')} RETURNING id` : text;

      let res: PgResult;
      try {
        res = await q(finalSql, params);
      } catch (error) {
        // Tables such as app_meta(key, value) have no id column. Retry once
        // without RETURNING rather than special-casing every INSERT.
        const message = error instanceof Error ? error.message : String(error);
        if (isInsert && /column "id" does not exist/i.test(message)) {
          res = await q(text, params);
          return { changes: res.rowCount ?? 0, lastInsertRowid: null };
        }
        throw error;
      }

      return {
        changes: res.rowCount ?? 0,
        lastInsertRowid: isInsert ? Number(res.rows[0]?.id ?? 0) || null : null,
      };
    },
    exec: async (sql) => {
      await q(sql, []);
    },
    transaction: async <T,>(fn: () => Promise<T>): Promise<T> => {
      // Nested calls join the outer transaction instead of opening a new one.
      if (clientStore.getStore()) return fn();

      const client = await connect();
      try {
        await client.query('BEGIN');
        const result = await clientStore.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* connection may be gone */
        }
        throw error;
      } finally {
        (client as any).release?.();
      }
    },
    close: async () => {
      /* pool is closed by the owner below */
    },
  };
}

function needsSsl(connectionString: string): boolean {
  if (/sslmode=disable/.test(connectionString)) return false;
  if (/sslmode=(require|verify-ca|verify-full)/.test(connectionString)) return false; // pg handles it
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

export function createDatabase(): { db: Driver; pool?: pg.Pool } {
  const url = process.env.DATABASE_URL;

  if (url && url.startsWith('pglite:')) {
    // Embedded Postgres for tests: real Postgres semantics, no server needed.
    const { PGlite } = require('@electric-sql/pglite');
    const lite = new PGlite();
    const executor = createPgExecutor('pglite', async () => ({
      query: async (text: string, params?: unknown[]) => {
        // PGlite's query() takes one statement; exec() runs a script.
        const isScript = (!params || params.length === 0) && /;\s*\S/.test(text);
        if (isScript) {
          const results = await lite.exec(text);
          const last = results[results.length - 1];
          return {
            rows: ((last?.rows ?? []) as Row[]),
            rowCount: last?.affectedRows ?? 0,
          };
        }
        const res = await lite.query(text, params as any[]);
        return { rows: res.rows as Row[], rowCount: res.affectedRows ?? res.rows.length };
      },
    }));
    return { db: executor };
  }

  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 10),
      ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (error) => console.error('[db] idle Postgres client error:', error.message));
    console.log('[db] Postgres via DATABASE_URL');
    const executor = createPgExecutor('postgres', async () => pool.connect());
    return { db: executor, pool };
  }

  return { db: createSqliteDriver() };
}

const created = createDatabase();

export const db = {
  kind: created.db.kind,
  describe: () => created.db.describe(),
  all: (sql: string, ...params: unknown[]) => created.db.all(sql, params),
  get: (sql: string, ...params: unknown[]) => created.db.get(sql, params),
  run: (sql: string, ...params: unknown[]) => created.db.run(sql, params),
  exec: (sql: string) => created.db.exec(sql),
  transaction: <T,>(fn: () => Promise<T>) => created.db.transaction(fn),
  close: async () => {
    await created.db.close();
    await created.pool?.end();
  },
};

export const usingPostgres = db.kind === 'postgres';
