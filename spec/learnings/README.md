# Learnings

Key findings about this codebase. Read the relevant entries before touching a module.

| Learning | Applies to |
|----------|-----------|
| [Lock a parent row with FOR NO KEY UPDATE, not FOR UPDATE](postgres-row-lock-vs-foreign-keys.md) | `api/src/kudos.ts`, any transaction that locks `users` and inserts `kudos` |
