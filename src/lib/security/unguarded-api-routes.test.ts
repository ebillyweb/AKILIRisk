import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function findRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findRouteFiles(full));
    } else if (entry === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

/**
 * Sweep: sensitive debug/test API routes must ship with explicit production
 * guards. This test fails if a new route appears under api/debug or api/test
 * without referencing a known gate helper.
 */
describe("unguarded API route sweep", () => {
  it("every api/debug route is production-guarded", () => {
    const root = join(process.cwd(), "src/app/api/debug");
    const routes = findRouteFiles(root);
    expect(routes.length).toBeGreaterThan(0);

    for (const file of routes) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/NODE_ENV.*production|debugTotpEnabled|Not found/);
    }
  });

  it("every api/test route uses isTestAuthEnabled gating", () => {
    const root = join(process.cwd(), "src/app/api/test");
    const routes = findRouteFiles(root);
    expect(routes.length).toBeGreaterThan(0);

    for (const file of routes) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/isTestAuthEnabled/);
    }
  });
});
