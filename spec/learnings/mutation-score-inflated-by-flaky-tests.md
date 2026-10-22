---
category: testing
topic: mutation-score-inflated-by-flaky-tests
discovered: 2026-10-22
feature: mutation-testing (ADR 0001)
---

# A flaky test suite inflates the mutation score

**Finding.** Stryker counts any failing test run as a killed mutant. While the test helper force-dropped
each file's database (`DROP DATABASE … WITH (FORCE)`), a connection that was still closing sometimes
failed with "terminating connection" as an unhandled error, so random runs failed. Locally that read as
**85.09%**; the honest score is **73.91%** (e.g. deleting the `/api/health` route was "killed", though no
test calls it).

**How to apply.**
- Before trusting or gating on a score, run it twice (or on two machines) and diff the survivor lists —
  they must be identical.
- A mutant "killed" in code no test exercises is a red flag for flakiness, not a good test.
- Keep test teardown free of races; prefer discarding the whole container over dropping databases.

**Evidence.** PR #2 CI run 39804416031 and a local rerun after the fix: both 73.91%, identical 42 survivors.
