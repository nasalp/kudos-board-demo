# 0001 — Mutation testing with Stryker

- Status: accepted
- Date: 2026-10-22

## Context

Line coverage says code ran, not that a test would notice if it were wrong. The harness recommends Stryker
for TypeScript (the PITest equivalent). This repo uses Vitest 5 and TypeScript 7, and its acceptance
tests run against a real Postgres (Testcontainers).

## Decision

- **Tool:** Stryker 10 (`@stryker-mutator/core`) in `api/`, config in `api/stryker.config.mjs`,
  run with `npm run mutation`. It mutates `src/**/*.ts` except `server.ts` (env wiring only).
- **Runner:** Stryker's `command` runner (`npx vitest run --bail=1` per mutant), not
  `@stryker-mutator/vitest-runner`. Version 10 of that runner targets Vitest 4; under Vitest 5 it runs
  zero tests per mutant and reports every mutant as survived (measured: 13% score, 0% on `kudos.ts`).
  The command runner gives correct results at the cost of running the whole suite per mutant.
- **No TypeScript checker:** `@stryker-mutator/typescript-checker` and Stryker's tsconfig rewrite need
  the TypeScript JS API, which TypeScript 7 doesn't ship. Type-broken mutants simply run.
- **Faster tests:** one Postgres container per test run, with a template database copied per test file,
  so a mutant run takes about 2 s instead of starting a container per file.
- **Gate:** CI job `mutation-tests` on pull requests and manual runs (not on push to `main`, ~4 min).
  It fails below a score of **95%** (`thresholds.break`). The HTML report is uploaded as an artifact.
- **Score history:** baseline **73.91%** (117 killed, 2 timeouts, 42 survived of 161; identical locally
  and on GitHub's runner). After adding tests for the untested behaviour: **100%** (151 killed,
  2 timeouts, 0 survived of 153), identical across two consecutive runs.
- **Equivalent mutants** are excluded with a `// Stryker disable next-line <mutator>: <reason>` comment.
  The only one so far: the `^`/`$` anchors of the team time-zone pattern (`api/src/app.ts`), checked
  against every zone name Node knows.

## Inputs / outputs / compatibility

- Input: the API source and acceptance tests. Output: a score and an HTML report; exit code 1 below 95%.
- No change to app behaviour or to `npm test` results. Existing CI jobs are unchanged.
- PR review: survivors in lines a PR added must be killed; survivors in untouched lines are legacy debt
  (harness rule `common/testing.md`, PR-owned vs legacy scoring).

## Consequences

- Revisit the Vitest runner (per-test coverage, faster) and the TypeScript checker when they support
  Vitest 5 / TypeScript 7.
- New code must keep the score at or above 95%.

## Verification

- A mutant range that "survived" under the Vitest runner (`kudos.ts:139-141`) is killed by the command runner.
- `npm run mutation` (baseline, before the new tests): 73.91% locally (3 min 37 s, M-series Mac, `concurrency: 4`) and on GitHub Actions
  (9 min), with the same 42 survivors.
- An earlier local run reported 85.09%: a flaky test cleanup (forced `DROP DATABASE`) failed random test
  runs, which Stryker counts as kills. Fixed before the baseline was taken; see
  `spec/learnings/mutation-score-inflated-by-flaky-tests.md`.
