// Acceptance tests for spec/features/give-kudos/give-kudos.md.
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

describe("AC-KUDOS-1", () => {
  it("records kudos given to a teammate and shows it on the leaderboard and in recent kudos", async () => {
    const res = await give("Anna", "Bartek");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ from: "Anna", to: "Bartek" });

    const board = await request(app).get("/api/leaderboard");
    expect(board.body).toEqual([{ name: "Bartek", count: 1 }]);

    const recent = await request(app).get("/api/kudos/recent");
    expect(recent.body).toHaveLength(1);
    expect(recent.body[0]).toMatchObject({ from: "Anna", to: "Bartek" });
  });
});

describe("AC-KUDOS-2", () => {
  it("rejects kudos to yourself and records nothing", async () => {
    const res = await give("Anna", "Anna");

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("You can't give kudos to yourself.");

    const board = await request(app).get("/api/leaderboard");
    expect(board.body).toEqual([]);
  });
});

describe("AC-KUDOS-3", () => {
  it("ranks teammates by kudos received, most first, ties alphabetically", async () => {
    await give("Anna", "Celina");
    await give("Bartek", "Celina");
    await give("Anna", "Darek");
    await give("Celina", "Bartek");

    const board = await request(app).get("/api/leaderboard");

    expect(board.body).toEqual([
      { name: "Celina", count: 2 },
      { name: "Bartek", count: 1 },
      { name: "Darek", count: 1 },
    ]);
  });
});

describe("AC-KUDOS-4", () => {
  it("lists recent kudos newest first", async () => {
    await give("Anna", "Bartek");
    await give("Celina", "Darek");

    const recent = await request(app).get("/api/kudos/recent");

    expect(recent.body.map((k: { from: string; to: string }) => `${k.from}->${k.to}`)).toEqual([
      "Celina->Darek",
      "Anna->Bartek",
    ]);
  });
});

describe("AC-KUDOS-5", () => {
  it("rejects kudos to or from someone who isn't on the team and records nothing", async () => {
    const anna = await db.userId("Anna");

    const toUnknown = await request(app).post("/api/kudos").send({ fromUserId: anna, toUserId: 99999 });
    const fromUnknown = await request(app).post("/api/kudos").send({ fromUserId: 99999, toUserId: anna });

    for (const res of [toUnknown, fromUnknown]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Unknown team member.");
    }
    expect((await request(app).get("/api/kudos/recent")).body).toEqual([]);
  });
});

describe("AC-KUDOS-6", () => {
  it("rejects kudos without a giver or a receiver and records nothing", async () => {
    const anna = await db.userId("Anna");

    const requests = [
      request(app).post("/api/kudos").send({ fromUserId: anna }),
      request(app).post("/api/kudos").send({ toUserId: anna }),
      request(app).post("/api/kudos").send({ fromUserId: "anna", toUserId: anna }),
      request(app).post("/api/kudos"),
    ];

    for (const res of await Promise.all(requests)) {
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("fromUserId and toUserId are required.");
    }
    expect((await request(app).get("/api/kudos/recent")).body).toEqual([]);
  });
});

describe("AC-KUDOS-7", () => {
  it("lists the whole team alphabetically", async () => {
    const res = await request(app).get("/api/users");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: await db.userId("Anna"), name: "Anna" },
      { id: await db.userId("Bartek"), name: "Bartek" },
      { id: await db.userId("Celina"), name: "Celina" },
      { id: await db.userId("Darek"), name: "Darek" },
    ]);
  });
});
