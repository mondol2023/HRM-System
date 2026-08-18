// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 15000,
    // Serial: tests share one Mongo/Redis instance, not mongodb-memory-server.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["src/scripts/**", "src/cluster.ts", "src/server.ts", "src/workers/**"],
    },
  },
});
