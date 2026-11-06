import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/**/actions.ts", "src/app/**/route.ts"],
      exclude: ["src/lib/supabase/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/db/**/*.test.ts", "tests/actions/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/global.ts"],
          setupFiles: ["tests/setup/each-file.ts"],
          // All files share one local database
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
