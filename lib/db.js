// Neon Postgres via the HTTP driver. Tables are created on first use.
import { neon } from "@neondatabase/serverless";

let _sql = null;
export function sql() {
  if (_sql) return _sql;
  if (process.env.TEST_PG_URL) {
    // Local tests run against a plain Postgres through node-postgres, exposed with the same tagged-template shape.
    let pool = null;
    _sql = async (strings, ...vals) => {
      if (!pool) { const { default: pg } = await import("pg"); pool = new pg.Pool({ connectionString: process.env.TEST_PG_URL }); }
      const text = strings.reduce((acc, s, i) => acc + s + (i < vals.length ? "$" + (i + 1) : ""), "");
      return (await pool.query(text, vals)).rows;
    };
    return _sql;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

let ready = null;
export function ensureSchema() {
  if (ready) return ready;
  const q = sql();
  ready = (async () => {
    await q`CREATE TABLE IF NOT EXISTS visitors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization TEXT,
      lang TEXT,
      user_agent TEXT,
      ip TEXT,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      visits INTEGER NOT NULL DEFAULT 0
    )`;
    await q`CREATE UNIQUE INDEX IF NOT EXISTS visitors_email_idx ON visitors (lower(email))`;
    await q`CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      at TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind TEXT NOT NULL DEFAULT 'page',
      user_agent TEXT,
      ip TEXT
    )`;
    await q`CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      rating INTEGER,
      strongest TEXT,
      weakest TEXT,
      missing TEXT,
      lang TEXT,
      context TEXT,
      at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await q`CREATE TABLE IF NOT EXISTS opportunities (
      id SERIAL PRIMARY KEY,
      name TEXT, email TEXT, lang TEXT,
      title TEXT NOT NULL, company TEXT, role TEXT, sector TEXT, stage TEXT,
      description TEXT NOT NULL, mode TEXT, customer TEXT, size TEXT, timing TEXT,
      ip TEXT, needs TEXT, more TEXT, phone TEXT, contact_ok BOOLEAN NOT NULL DEFAULT true,
      at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
