import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration tests hit a real DB and must not run concurrently against
    // shared tables. Pure-function tests are fast either way.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
