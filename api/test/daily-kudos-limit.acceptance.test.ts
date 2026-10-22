// Acceptance tests for spec/features/daily-kudos-limit/daily-kudos-limit.md.
// Each describe() is named after the AC ID of the Gherkin scenario it proves.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { startTestDb, type TestDb } from "./support";

let db: TestDb;
let now: Date;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp(db.pool, { now: () => now });
});

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  now = new Date("2026-10-22T10:00:00Z");
});

async function give(from: string, to: string, target = app) {
  return request(target)
    .post("/api/kudos")
    .send({ fromUserId: await db.userId(from), toUserId: await db.userId(to) });
}

async function givenCount(from: string): Promise<number> {
  const { rows } = await db.pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM kudos WHERE from_user = $1", [
    await db.userId(from),
  ]);
  return Number(rows[0].n);
}

describe("AC-LIMIT-1", () => {
  it("accepts the third kudos of the day and tells the giver none are left", async () => {
    await give("Anna", "Celina");
    await give("Anna", "Darek");

    const res = await give("Anna", "Bartek");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ from: "Anna", to: "Bartek", remainingToday: 0 });

    const recent = await request(app).get("/api/kudos/recent");
    expect(recent.body).toHaveLength(3);
  });
});

describe("AC-LIMIT-2", () => {
  it("rejects the fourth kudos of the day and records nothing", async () => {
    await give("Anna", "Bartek");
    await give("Anna", "Bartek");
    await give("Anna", "Celina");

    const res = await give("Anna", "Bartek");

    expect(res.status).toBe(429);
    expect(res.body.error).toBe("You've used all 3 kudos for today. Come back tomorrow!");
    expect(await givenCount("Anna")).toBe(3);
  });
});

describe("AC-LIMIT-3", () => {
  it("gives a fresh allowance the next day", async () => {
    now = new Date("2026-10-21T15:00:00Z");
    await give("Anna", "Bartek");
    await give("Anna", "Celina");
    await give("Anna", "Darek");

    now = new Date("2026-10-22T09:00:00Z");
    const res = await give("Anna", "Bartek");

    expect(res.status).toBe(201);
    expect(res.body.remainingToday).toBe(2);
  });

  it("resets at midnight in the team's time zone, not at midnight UTC", async () => {
    const warsaw = createApp(db.pool, { now: () => now, timeZone: "Europe/Warsaw" });

    // 23:30 on 22 Oct in Warsaw (UTC+2) — still the 22nd in UTC as well.
    now = new Date("2026-10-22T21:30:00Z");
    await give("Anna", "Bartek", warsaw);
    await give("Anna", "Celina", warsaw);
    await give("Anna", "Darek", warsaw);

    // 00:30 on 23 Oct in Warsaw, but still 22:30 on 22 Oct in UTC.
    now = new Date("2026-10-22T22:30:00Z");
    expect((await give("Anna", "Bartek", warsaw)).status).toBe(201);
    expect((await give("Anna", "Bartek", app)).status).toBe(429);
  });
});

describe("AC-LIMIT-4", () => {
  it("does not limit other team members when one has used their allowance", async () => {
    await give("Anna", "Bartek");
    await give("Anna", "Celina");
    await give("Anna", "Darek");

    const res = await give("Bartek", "Anna");

    expect(res.status).toBe(201);
    expect(res.body.remainingToday).toBe(2);
  });
});

describe("AC-LIMIT-5", () => {
  it("does not count rejected attempts toward the allowance", async () => {
    await give("Anna", "Bartek");
    await give("Anna", "Celina");
    expect((await give("Anna", "Anna")).status).toBe(422);

    const res = await give("Anna", "Bartek");

    expect(res.status).toBe(201);
    expect(res.body.remainingToday).toBe(0);
  });
});

describe("AC-LIMIT-6", () => {
  it("records exactly one of two kudos sent at the same moment with one left", async () => {
    await give("Anna", "Darek");
    await give("Anna", "Darek");

    const results = await Promise.all([give("Anna", "Bartek"), give("Anna", "Celina")]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 429]);
    expect(await givenCount("Anna")).toBe(3);
  });

  it("never exceeds the limit under a burst of simultaneous kudos", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => give("Anna", "Bartek")));

    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(await givenCount("Anna")).toBe(3);
  });
});

describe("AC-LIMIT-6", () => {
  it("accepts two teammates giving each other kudos at the same moment", async () => {
    for (let round = 0; round < 10; round++) {
      await db.reset();
      const results = await Promise.all([give("Anna", "Bartek"), give("Bartek", "Anna")]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
    }
  });
});

describe("AC-LIMIT-3", () => {
  it("refuses to start with a team time zone that isn't a region name", () => {
    expect(() => createApp(db.pool, { timeZone: "+05:00" })).toThrow(/time zone/i);
    expect(() => createApp(db.pool, { timeZone: "Mars/Olympus" })).toThrow(/time zone/i);
  });
});

describe("AC-LIMIT-7", () => {
  it("reports how many kudos a team member has left today", async () => {
    await give("Anna", "Bartek");
    await give("Anna", "Celina");

    const res = await request(app).get(`/api/users/${await db.userId("Anna")}/allowance`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ limit: 3, given: 2, remaining: 1 });
  });

  it("rejects an allowance request for an unknown team member", async () => {
    expect((await request(app).get("/api/users/99999/allowance")).status).toBe(404);
    expect((await request(app).get("/api/users/abc/allowance")).status).toBe(400);
  });
});
