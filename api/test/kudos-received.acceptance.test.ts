// Acceptance tests for spec/features/kudos-received/kudos-received.md.
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

describe("AC-RECV-1", () => {
  it("shows how many kudos a team member has received", async () => {
    await give("Bartek", "Anna");
    await give("Celina", "Anna");

    const res = await request(app).get(`/api/users/${await db.userId("Anna")}/received`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Anna", received: 2 });
  });
});

describe("AC-RECV-2", () => {
  it("rejects a lookup for someone who isn't on the team", async () => {
    const res = await request(app).get("/api/users/99999/received");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Unknown team member." });
  });

  it("rejects a lookup with an id that can't be a team member", async () => {
    for (const id of ["abc", "0", "-1"]) {
      const res = await request(app).get(`/api/users/${id}/received`);
      expect(res.status, id).toBe(400);
      expect(res.body).toEqual({ error: "A valid team member id is required." });
    }
  });
});
