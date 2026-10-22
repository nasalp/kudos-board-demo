import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import type { TestProject } from "vitest/node";

const DB_DIR = join(__dirname, "..", "db");
export const TEMPLATE_DB = "kudos_template";

declare module "vitest" {
  export interface ProvidedContext {
    pgUri: string;
  }
}

/** Database URI for `name` on the same server as `uri`. */
export function dbUri(uri: string, name: string): string {
  const url = new URL(uri);
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Starts one real Postgres 16 per test run and loads every db/*.sql file in order into a template
 * database. Each test file then gets its own copy (see support.ts), so files never share data.
 */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const uri = container.getConnectionUri();

  const admin = new Pool({ connectionString: uri });
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const template = new Pool({ connectionString: dbUri(uri, TEMPLATE_DB) });
  for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await template.query(readFileSync(join(DB_DIR, file), "utf8"));
  }
  await template.end();

  project.provide("pgUri", uri);
  return async () => {
    await container.stop();
  };
}
