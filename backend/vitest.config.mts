import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Most suites are pure-function / mocked-Prisma unit tests and need no DB.
    // Integration suites self-skip when DATABASE_URL_TEST is unset.
    setupFiles: [],
    clearMocks: true,
    restoreMocks: true,
  },
});
