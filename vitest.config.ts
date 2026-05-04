import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Source-side unit tests only. Playwright specs live under tests/smoke/
    // and use the same `.spec.ts` extension; if vitest picks them up they
    // fail at module-load with "Playwright Test did not expect
    // test.describe() to be called here" because Playwright's runtime
    // isn't bootstrapped. Excluding the tests/ tree keeps `npm test`
    // output to real signal.
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "tests/**",
    ],
    globals: true,
    env: {
      AUTH_SECRET: "test-secret-for-vitest",
    },
  },
});
