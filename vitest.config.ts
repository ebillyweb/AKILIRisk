import path from "path";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    // `mobile/` is a separate Expo project with its own Jest runner.
    exclude: [...configDefaults.exclude, "mobile/**"],
    globals: true,
    env: {
      AUTH_SECRET: "test-secret-for-vitest",
    },
  },
});
