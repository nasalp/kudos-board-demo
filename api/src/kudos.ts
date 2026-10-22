import type { Pool, PoolClient } from "pg";

export const DAILY_KUDOS_LIMIT = 3;

/** What "today" means: the current time and the team's time zone (IANA name, e.g. "UTC", "Europe/Warsaw"). */
export interface KudosDay {
  now: () => Date;
  timeZone: string;
}

export interface User {
  id: number;
  name: string;
}

export interface Kudos {
  id: number;
  from: string;
  to: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  name: string;
  count: number;
}

export interface Allowance {
  limit: number;
  given: number;
  remaining: number;
}

export type GiveKudosResult =
  | { ok: true; kudos: Kudos; remainingToday: number }
  | { ok: false; reason: "SELF_KUDOS" | "UNKNOWN_USER" | "DAILY_LIMIT"; message: string };

export async function listUsers(pool: Pool): Promise<User[]> {
  const { rows } = await pool.query<User>("SELECT id, name FROM users ORDER BY name");
  return rows;
}

export async function giveKudos(
  pool: Pool,
  fromUserId: number,
  toUserId: number,
  day: KudosDay,
): Promise<GiveKudosResult> {
  if (fromUserId === toUserId) {
    return { ok: false, reason: "SELF_KUDOS", message: "You can't give kudos to yourself." };
  }
  const client = await pool.connect();
  let failure: Error | undefined;
  try {
    await client.query("BEGIN");
    // Locking the giver's row serialises their concurrent kudos, so the daily count can't be raced past the limit.
    // NO KEY UPDATE (not UPDATE) doesn't block the foreign-key check of kudos *to* this person, so two teammates
    // giving each other kudos at the same moment don't deadlock.
    const { rows: fromRows } = await client.query<User>("SELECT id, name FROM users WHERE id = $1 FOR NO KEY UPDATE", [
      fromUserId,
    ]);
    const { rows: toRows } = await client.query<User>("SELECT id, name FROM users WHERE id = $1", [toUserId]);
    const from = fromRows[0];
    const to = toRows[0];
    if (!from || !to) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "UNKNOWN_USER", message: "Unknown team member." };
    }
    const now = day.now();
    const given = await countGivenToday(client, fromUserId, now, day.timeZone);
    if (given >= DAILY_KUDOS_LIMIT) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "DAILY_LIMIT",
        message: `You've used all ${DAILY_KUDOS_LIMIT} kudos for today. Come back tomorrow!`,
      };
    }
    const { rows } = await client.query<{ id: number; created_at: Date }>(
      "INSERT INTO kudos (from_user, to_user, created_at) VALUES ($1, $2, $3) RETURNING id, created_at",
      [fromUserId, toUserId, now],
    );
    await client.query("COMMIT");
    return {
      ok: true,
      kudos: { id: rows[0].id, from: from.name, to: to.name, createdAt: rows[0].created_at.toISOString() },
      remainingToday: DAILY_KUDOS_LIMIT - given - 1,
    };
  } catch (err) {
    failure = err as Error;
    throw err;
  } finally {
    // On an error the connection is discarded, not pooled: closing it rolls back the open transaction.
    client.release(failure);
  }
}

/** Total kudos a team member has received, or null for an unknown team member. */
export async function kudosReceived(pool: Pool, userId: number): Promise<{ name: string; received: number } | null> {
  const { rows } = await pool.query<{ name: string; received: string }>(
    `SELECT u.name, COUNT(k.id) AS received
       FROM users u
       LEFT JOIN kudos k ON k.to_user = u.id
      WHERE u.id = $1
      GROUP BY u.name`,
    [userId],
  );
  return rows[0] ? { name: rows[0].name, received: Number(rows[0].received) } : null;
}

/** The giver's allowance for today, or null for an unknown team member. */
export async function allowance(pool: Pool, userId: number, day: KudosDay): Promise<Allowance | null> {
  const { rows } = await pool.query("SELECT 1 FROM users WHERE id = $1", [userId]);
  if (rows.length === 0) return null;
  const given = await countGivenToday(pool, userId, day.now(), day.timeZone);
  return { limit: DAILY_KUDOS_LIMIT, given, remaining: Math.max(0, DAILY_KUDOS_LIMIT - given) };
}

async function countGivenToday(db: Pool | PoolClient, fromUserId: number, now: Date, timeZone: string) {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n
       FROM kudos
      WHERE from_user = $1
        AND created_at >= (date_trunc('day', $2::timestamptz AT TIME ZONE $3) AT TIME ZONE $3)
        AND created_at < ((date_trunc('day', $2::timestamptz AT TIME ZONE $3) + interval '1 day') AT TIME ZONE $3)`,
    [fromUserId, now, timeZone],
  );
  return Number(rows[0].n);
}

export async function leaderboard(pool: Pool): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query<{ name: string; count: string }>(
    `SELECT u.name, COUNT(k.id) AS count
       FROM users u
       JOIN kudos k ON k.to_user = u.id
      GROUP BY u.name
      ORDER BY COUNT(k.id) DESC, u.name ASC`,
  );
  return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

export async function recentKudos(pool: Pool, limit = 10): Promise<Kudos[]> {
  const { rows } = await pool.query<{ id: number; from: string; to: string; created_at: Date }>(
    `SELECT k.id, f.name AS "from", t.name AS "to", k.created_at
       FROM kudos k
       JOIN users f ON f.id = k.from_user
       JOIN users t ON t.id = k.to_user
      ORDER BY k.created_at DESC, k.id DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ id: r.id, from: r.from, to: r.to, createdAt: r.created_at.toISOString() }));
}
