// Acceptance tests for spec/features/most-generous/most-generous.md.
// Each describe() is named after the AC ID of the Gherkin scenario it proves.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { startTestDb, type TestDb } from "./support";

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp(db.pool);
});

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
});

async function give(from: string, to: string) {
  return request(app)
    .post("/api/kudos")
    .send({ fromUserId: await db.userId(from), toUserId: await db.userId(to) });
}

describe("AC-GIVERS-1", () => {
  it("ranks team members by kudos given, most first, ties alphabetically", async () => {
    await give("Anna", "Darek");
    await give("Anna", "Bartek");
    await give("Celina", "Anna");
    await give("Bartek", "Celina");

    const res = await request(app).get("/api/leaderboard/givers");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { name: "Anna", count: 2 },
      { name: "Bartek", count: 1 },
      { name: "Celina", count: 1 },
    ]);
  });
});

describe("AC-GIVERS-2", () => {
  it("lists nobody before any kudos are given", async () => {
    const res = await request(app).get("/api/leaderboard/givers");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
