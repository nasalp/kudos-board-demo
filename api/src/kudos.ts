import type { Pool } from "pg";

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

export type GiveKudosResult =
  | { ok: true; kudos: Kudos }
  | { ok: false; reason: "SELF_KUDOS" | "UNKNOWN_USER"; message: string };

export async function listUsers(pool: Pool): Promise<User[]> {
  const { rows } = await pool.query<User>("SELECT id, name FROM users ORDER BY name");
  return rows;
}

export async function giveKudos(pool: Pool, fromUserId: number, toUserId: number): Promise<GiveKudosResult> {
  if (fromUserId === toUserId) {
    return { ok: false, reason: "SELF_KUDOS", message: "You can't give kudos to yourself." };
  }
  const { rows: users } = await pool.query<User>("SELECT id, name FROM users WHERE id = ANY($1)", [
    [fromUserId, toUserId],
  ]);
  const from = users.find((u) => u.id === fromUserId);
  const to = users.find((u) => u.id === toUserId);
  if (!from || !to) {
    return { ok: false, reason: "UNKNOWN_USER", message: "Unknown team member." };
  }
  const { rows } = await pool.query<{ id: number; created_at: Date }>(
    "INSERT INTO kudos (from_user, to_user) VALUES ($1, $2) RETURNING id, created_at",
    [fromUserId, toUserId],
  );
  return {
    ok: true,
    kudos: { id: rows[0].id, from: from.name, to: to.name, createdAt: rows[0].created_at.toISOString() },
  };
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
