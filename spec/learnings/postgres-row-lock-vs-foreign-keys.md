---
category: postgres
topic: row-lock-vs-foreign-keys
discovered: 2026-10-22
feature: daily-kudos-limit
---

# Lock a parent row with FOR NO KEY UPDATE, not FOR UPDATE

**Finding.** `SELECT … FOR UPDATE` on a `users` row conflicts with the `FOR KEY SHARE`
lock Postgres takes on that row whenever a `kudos` row referencing it is inserted.
Two transactions that each lock their own giver and insert a kudos *to* the other
deadlock (Anna → Bartek and Bartek → Anna at the same moment): one gets a 500 after
`deadlock_timeout` (~1 s).

**Fix.** Use `FOR NO KEY UPDATE` when the lock only serialises work (e.g. a per-user
counter check) and the key isn't changing. It still conflicts with itself, but not
with foreign-key checks. `pg_advisory_xact_lock(id)` is the alternative.

**Evidence.** `api/test/daily-kudos-limit.acceptance.test.ts` — AC-LIMIT-6
"accepts two teammates giving each other kudos at the same moment" failed with
`FOR UPDATE`, passes with `FOR NO KEY UPDATE`.
