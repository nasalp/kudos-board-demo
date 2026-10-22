import { Pool } from "pg";
import { createApp } from "./app";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://kudos:kudos@localhost:5432/kudos",
});
const port = Number(process.env.PORT ?? 3000);

createApp(pool, { timeZone: process.env.TEAM_TIME_ZONE || "UTC" }).listen(port, () => {
  console.log(`Kudos API listening on :${port}`);
});
