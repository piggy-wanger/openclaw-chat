import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./lib/test/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
