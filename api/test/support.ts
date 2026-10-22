import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { inject } from "vitest";
import { dbUri, TEMPLATE_DB } from "./global-setup";

export interface TestDb {
  pool: Pool;
  /** Connection string of this test database, for connections outside the pool. */
  uri: string;
  userId(name: string): Promise<number>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

// Postgres refuses to copy a template that another CREATE DATABASE is copying at the same moment.
const CREATE_DB_LOCK = 4242;

/** A private copy of the app's database (schema + seed) on the shared test Postgres. */
export async function startTestDb(): Promise<TestDb> {
  const serverUri = inject("pgUri");
  const name = `kudos_test_${randomUUID().replaceAll("-", "")}`;

  const admin = new Pool({ connectionString: serverUri, max: 1 });
  await admin.query("SELECT pg_advisory_lock($1)", [CREATE_DB_LOCK]);
  try {
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`);
  } finally {
    await admin.query("SELECT pg_advisory_unlock($1)", [CREATE_DB_LOCK]);
  }

  const uri = dbUri(serverUri, name);
  const pool = new Pool({ connectionString: uri });
  return {
    pool,
    uri,
    async userId(userName: string) {
      const { rows } = await pool.query<{ id: number }>("SELECT id FROM users WHERE name = $1", [userName]);
      if (!rows[0]) throw new Error(`no such seeded user: ${userName}`);
      return rows[0].id;
    },
    async reset() {
      await pool.query("TRUNCATE kudos RESTART IDENTITY");
    },
    async stop() {
      // No DROP DATABASE: the whole container is discarded after the run, and a forced drop races with
      // connections that are still closing (they then fail with "terminating connection").
      await pool.end();
      await admin.end();
    },
  };
}
