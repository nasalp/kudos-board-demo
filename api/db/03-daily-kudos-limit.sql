-- Daily kudos limit: count a giver's kudos for one day without scanning the table.
-- Postgres runs db/*.sql only when the database is first created. For an existing database,
-- run this file by hand (or reset with `docker compose down -v`). Rollback: DROP INDEX kudos_from_user_created_at_idx;
CREATE INDEX kudos_from_user_created_at_idx ON kudos (from_user, created_at);
