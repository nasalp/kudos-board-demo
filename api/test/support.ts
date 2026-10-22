import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const DB_DIR = join(__dirname, "..", "db");

export interface TestDb {
  pool: Pool;
  container: StartedPostgreSqlContainer;
  userId(name: string): Promise<number>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** Starts a real Postgres 16 in Docker and loads every db/*.sql file in order, like the app's database. */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(join(DB_DIR, file), "utf8"));
  }
  return {
    pool,
    container,
    async userId(name: string) {
      const { rows } = await pool.query<{ id: number }>("SELECT id FROM users WHERE name = $1", [name]);
      if (!rows[0]) throw new Error(`no such seeded user: ${name}`);
      return rows[0].id;
    },
    async reset() {
      await pool.query("TRUNCATE kudos RESTART IDENTITY");
    },
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
}
