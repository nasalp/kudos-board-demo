import express, { type Request, type Response } from "express";
import type { Pool } from "pg";
import { giveKudos, leaderboard, listUsers, recentKudos } from "./kudos";

export function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/users", async (_req: Request, res: Response) => {
    res.json(await listUsers(pool));
  });

  app.post("/api/kudos", async (req: Request, res: Response) => {
    const fromUserId = Number(req.body?.fromUserId);
    const toUserId = Number(req.body?.toUserId);
    if (!Number.isInteger(fromUserId) || !Number.isInteger(toUserId)) {
      res.status(400).json({ error: "fromUserId and toUserId are required." });
      return;
    }
    const result = await giveKudos(pool, fromUserId, toUserId);
    if (!result.ok) {
      res.status(result.reason === "UNKNOWN_USER" ? 404 : 422).json({ error: result.message });
      return;
    }
    res.status(201).json(result.kudos);
  });

  app.get("/api/leaderboard", async (_req: Request, res: Response) => {
    res.json(await leaderboard(pool));
  });

  app.get("/api/kudos/recent", async (_req: Request, res: Response) => {
    res.json(await recentKudos(pool));
  });

  return app;
}
