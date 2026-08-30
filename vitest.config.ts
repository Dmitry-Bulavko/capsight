import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Fixture projects get a repository root for the duration of the run, so a
    // fixture scan stops at `project/` instead of walking into the Capsight
    // checkout and reading its `.claude/agents/` (D1-00, §13 invariant 2).
    globalSetup: ["tests/fixtures/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@adapters": path.resolve(__dirname, "src/adapters"),
      "@application": path.resolve(__dirname, "src/application"),
    },
  },
});
