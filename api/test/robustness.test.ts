// A rejected or failed kudos must not leave the database in a state that breaks the next kudos.
import { Client } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { giveKudos } from "../src/kudos";
import { startTestDb, type TestDb } from "./support";

let db: TestDb;
const today = { now: () => new Date("2026-10-22T10:00:00Z"), timeZone: "UTC" };

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
});

/** Transactions left open by the app's pooled connections, seen from a separate connection. */
async function openTransactions(): Promise<number> {
  const observer = new Client({ connectionString: db.uri });
  await observer.connect();
  try {
    const { rows } = await observer.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM pg_stat_activity
        WHERE datname = current_database() AND state LIKE 'idle in transaction%'`,
    );
    return Number(rows[0].n);
  } finally {
    await observer.end();
  }
}

describe("rejected kudos", () => {
  it("leaves no transaction open, so the giver's later kudos aren't blocked", async () => {
    const app = createApp(db.pool, { now: today.now });

    const res = await request(app).post("/api/kudos").send({ fromUserId: await db.userId("Anna"), toUserId: 99999 });

    expect(res.status).toBe(404);
    expect(await openTransactions()).toBe(0);
  });
});

describe("kudos that fails on a database error", () => {
  it("doesn't break the next kudos", async () => {
    const anna = await db.userId("Anna");
    const bartek = await db.userId("Bartek");

    // A time zone Postgres doesn't know makes the daily count fail inside the transaction.
    await expect(giveKudos(db.pool, anna, bartek, { ...today, timeZone: "Not/AZone" })).rejects.toThrow(/time zone/);

    const next = await giveKudos(db.pool, anna, bartek, today);
    expect(next.ok).toBe(true);
    expect(await openTransactions()).toBe(0);
  });
});
