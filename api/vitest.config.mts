import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // One Postgres container per run; each test file gets its own database copied from a template.
    globalSetup: ["test/global-setup.ts"],
    // Starting the Postgres container takes a few seconds on first run.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
