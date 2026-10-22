import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { inject } from "vitest";
import { dbUri, TEMPLATE_DB } from "./global-setup";

export interface TestDb {
  pool: Pool;
  userId(name: string): Promise<number>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

// Postgres refuses to copy a template that another CREATE DATABASE is copying at the same moment.
const CREATE_DB_LOCK = 4242;

/** A private copy of the app's database (schema + seed) on the shared test Postgres, dropped on stop(). */
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

  const pool = new Pool({ connectionString: dbUri(serverUri, name) });
  return {
    pool,
    async userId(userName: string) {
      const { rows } = await pool.query<{ id: number }>("SELECT id FROM users WHERE name = $1", [userName]);
      if (!rows[0]) throw new Error(`no such seeded user: ${userName}`);
      return rows[0].id;
    },
    async reset() {
      await pool.query("TRUNCATE kudos RESTART IDENTITY");
    },
    async stop() {
      await pool.end();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
