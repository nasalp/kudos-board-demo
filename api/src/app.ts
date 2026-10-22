import express, { type Request, type Response } from "express";
import type { Pool } from "pg";
import { allowance, giveKudos, type KudosDay, leaderboard, listUsers, recentKudos } from "./kudos";

export interface AppOptions {
  /** Clock used to decide which day a kudos belongs to. Defaults to the system clock. */
  now?: () => Date;
  /** Team time zone (IANA name); the daily kudos allowance resets at midnight here. Defaults to UTC. */
  timeZone?: string;
}

const MAX_PG_INT = 2_147_483_647;

function parseUserId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= MAX_PG_INT ? id : null;
}

// Only "UTC" or IANA region names (e.g. "Europe/Warsaw"): offsets like "+05:00" mean the opposite sign in Postgres.
// Stryker disable next-line Regex: dropping ^ or $ is equivalent, the Intl check below rejects anything extra
const REGION_TIME_ZONE = /^(UTC|[A-Za-z]+(\/[A-Za-z0-9_+-]+)+)$/;

/** Fails at startup on a misconfigured team time zone instead of on every kudos. */
function assertRegionTimeZone(timeZone: string) {
  let known = REGION_TIME_ZONE.test(timeZone);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    known = false;
  }
  if (!known) throw new Error(`Unknown team time zone "${timeZone}"; use UTC or a region such as Europe/Warsaw.`);
}

export function createApp(pool: Pool, options: AppOptions = {}) {
  const day: KudosDay = { now: options.now ?? (() => new Date()), timeZone: options.timeZone ?? "UTC" };
  assertRegionTimeZone(day.timeZone);

  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/users", async (_req: Request, res: Response) => {
    res.json(await listUsers(pool));
  });

  app.get("/api/users/:id/allowance", async (req: Request, res: Response) => {
    const userId = parseUserId(req.params.id);
    if (userId === null) {
      res.status(400).json({ error: "A valid team member id is required." });
      return;
    }
    const result = await allowance(pool, userId, day);
    if (!result) {
      res.status(404).json({ error: "Unknown team member." });
      return;
    }
    res.json(result);
  });

  app.post("/api/kudos", async (req: Request, res: Response) => {
    const fromUserId = Number(req.body?.fromUserId);
    const toUserId = Number(req.body?.toUserId);
    if (!Number.isInteger(fromUserId) || !Number.isInteger(toUserId)) {
      res.status(400).json({ error: "fromUserId and toUserId are required." });
      return;
    }
    const result = await giveKudos(pool, fromUserId, toUserId, day);
    if (!result.ok) {
      const status = { UNKNOWN_USER: 404, SELF_KUDOS: 422, DAILY_LIMIT: 429 }[result.reason];
      res.status(status).json({ error: result.message });
      return;
    }
    res.status(201).json({ ...result.kudos, remainingToday: result.remainingToday });
  });

  app.get("/api/leaderboard", async (_req: Request, res: Response) => {
    res.json(await leaderboard(pool));
  });

  app.get("/api/kudos/recent", async (_req: Request, res: Response) => {
    res.json(await recentKudos(pool));
  });

  return app;
}
