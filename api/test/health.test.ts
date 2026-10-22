// Liveness endpoint used by the Docker Compose health checks.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { startTestDb, type TestDb } from "./support";

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db?.stop();
});

describe("health check", () => {
  it("reports ok", async () => {
    const res = await request(createApp(db.pool)).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
