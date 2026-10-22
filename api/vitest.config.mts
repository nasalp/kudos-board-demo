import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Starting the Postgres container takes a few seconds on first run.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
