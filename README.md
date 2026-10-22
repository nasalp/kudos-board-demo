# Kudos Board (demo)

[![CI](https://github.com/nasalp/kudos-board-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/nasalp/kudos-board-demo/actions/workflows/ci.yml)

A tiny team app for demonstrating **spec-first development with Claude Code**:
team members give each other kudos by pressing buttons, kudos are stored in
Postgres, and a leaderboard shows who is appreciated.

It uses the [claude-code-starter](https://github.com/nasalp/claude-code-starter)
harness: every feature starts as a spec with **Gherkin acceptance criteria**
in [`spec/features/`](spec/features/), committed to this repo next to the code.

## Run it

Requires Docker (Docker Desktop, OrbStack or Colima).

```bash
docker compose up --build
# open http://localhost:8080
```

Pick who you are, press a 👍 button, and watch the leaderboard update.
Reset all data with `docker compose down -v`.

## Tests

```bash
cd api
npm ci
npm test          # acceptance tests against a real Postgres (Testcontainers, needs Docker)
npm run typecheck
```

CI runs the API tests, checks that every Gherkin scenario has a test named
after its AC ID, and smoke-tests the full Docker Compose stack.

## Specs

| Feature | Spec | Status |
|---------|------|--------|
| Give kudos | [`spec/features/give-kudos/give-kudos.md`](spec/features/give-kudos/give-kudos.md) | implemented |

## Demo script: creating a spec live

Prerequisite: the harness is installed (`./setup.sh` in claude-code-starter).

1. Open Claude Code in this repo.
2. Run one of the backlog features below, for example:

   ```
   /feature Each team member can give at most 3 kudos per day
   ```

3. Claude drafts the spec — user story, sequence diagram and Gherkin
   scenarios (`@AC-LIMIT-1`, …) — and **asks you to confirm before writing**.
   Trim or correct a scenario live: the agent drafts, the human approves.
4. Claude writes `spec/features/<slug>/<slug>.md`. Show it with
   `git status` / `git diff` — the spec is a normal file in the repo.
5. Stop here for the spec demo, or let Claude continue with the failing
   acceptance tests and the implementation.

### Backlog (good live-demo features)

| Feature | Why it makes good scenarios |
|---------|-----------------------------|
| Daily limit: max 3 kudos per person per day | Happy path, limit reached, limit resets next day, counter shown in the UI |
| Undo within 30 seconds | Undo inside the window, after the window, only your own kudos |
| Weekly leaderboard | Only this week's kudos count; last week's are ignored |
| Kudos with a short message | Optional text, max length, shown in the recent list |
