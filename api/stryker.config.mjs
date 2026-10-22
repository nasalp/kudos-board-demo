// Mutation testing: Stryker changes the code in src/ one small "mutant" at a time and reruns the acceptance
// tests. A mutant that no test notices shows a gap in the tests. Run with `npm run mutation`; the HTML report
// lands in reports/mutation/index.html.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // The command runner runs the plain test suite per mutant (the active mutant is passed in an env var).
  // @stryker-mutator/vitest-runner 10 targets Vitest 4 and silently runs zero tests per mutant under Vitest 5,
  // which reports every mutant as survived. Revisit once it supports Vitest 5.
  testRunner: "command",
  commandRunner: { command: "npx vitest run --bail=1" },
  // Skip rewriting tsconfig.json: it needs the TypeScript JS API, which TypeScript 7 no longer ships, and our
  // tsconfig has no extends/references to rewrite. Pointing at a file that doesn't exist turns it off.
  tsconfigFile: "no-tsconfig-rewrite.json",
  // server.ts only wires env vars into createApp; it has no logic the acceptance tests could observe.
  mutate: ["src/**/*.ts", "!src/server.ts"],
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  // break = CI fails below this score. Set just under the measured baseline (73.91%) so it can only go up;
  // raise it as survivors get killed.
  thresholds: { high: 90, low: 80, break: 70 },
  concurrency: 4,
  timeoutMS: 60000,
};
