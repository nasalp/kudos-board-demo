# Kudos Board — project context

Small demo web app: team members give each other kudos by pressing buttons;
kudos are stored in Postgres and shown on a leaderboard and a recent list.
Used to demonstrate spec-first development with Claude Code and the
[claude-code-starter](https://github.com/nasalp/claude-code-starter) harness.

## Tech stack

- **web/** — plain HTML + JavaScript (no build step), served by nginx, which proxies `/api` to the API
- **api/** — Node 22, TypeScript, Express 5, `pg`
- **db** — Postgres 16; schema and seed in `api/db/*.sql` (loaded on first start)
- **tests** — Vitest + Supertest, acceptance tests against a real Postgres via Testcontainers (needs Docker)
- Everything runs with Docker Compose

## Commands

| What | Command |
|------|---------|
| Run the app | `docker compose up --build` → http://localhost:8080 |
| Reset the database | `docker compose down -v` |
| API tests | `cd api && npm ci && npm test` |
| Type check | `cd api && npm run typecheck` |
| Mutation tests | `cd api && npm run mutation` → `api/reports/mutation/index.html` (~4 min, needs Docker) |
| Spec ↔ test traceability | `$AI_RULES_REPO/scripts/verify-ac-tests.sh --spec-dir spec/features --src-root api` |
| Features index | `python3 $AI_RULES_REPO/scripts/generate-features-index.py --spec-dir spec/features` |

## Conventions

- **Spec first.** New behaviour starts with `/feature`: the spec goes in
  `spec/features/<slug>/<slug>.md` with acceptance criteria as Gherkin
  scenarios tagged `@AC-<PREFIX>-<N>`. A human confirms the scenarios before
  any test or code is written. See `spec/features/give-kudos/` for an example.
- **AC ID = test name.** Acceptance tests live in `api/test/*.acceptance.test.ts`;
  each `describe()` is named after the AC ID it proves (`describe("AC-KUDOS-1", …)`).
- **Real database in tests.** Acceptance tests use Testcontainers Postgres, never mocks. One container per
  run (`api/test/global-setup.ts`); each test file gets its own database copied from a template.
- **Mutation score must not drop.** Stryker gates PRs at 80% (`api/stryker.config.mjs`). A new survivor in
  code your PR added needs a test; survivors in untouched code are legacy debt (see ADR 0001).
- **Business rules live in `api/src/kudos.ts`**; `app.ts` only maps HTTP to those functions.
- **Schema changes** go in a new numbered file in `api/db/` (e.g. `03-…sql`); never edit applied files.

## Module map

| Path | Contents |
|------|----------|
| `api/src/kudos.ts` | Business rules: give kudos (with the daily limit), allowance, leaderboard, recent list |
| `api/src/app.ts` | Express routes (`/api/users`, `/api/users/:id/allowance`, `/api/kudos`, `/api/leaderboard`, `/api/kudos/recent`) |
| `api/db/` | SQL schema + seed |
| `api/test/` | Acceptance tests + Testcontainers helper |
| `web/` | Front end (`index.html`, `app.js`, `style.css`) and nginx config |
| `spec/` | Feature specs (Gherkin acceptance criteria) |

## Configuration

- `TEAM_TIME_ZONE` (default `UTC`) — the daily kudos allowance resets at midnight in this zone.

## External services

None. No mocking needed beyond the Testcontainers database.
