/**
 * Redirect bare `server-only` imports to a no-op when running under tsx.
 * Import this before any `@/lib/*` module that uses `import "server-only"`.
 *
 * Next/Vitest already handle this via bundler aliases; CLI scripts do not.
 */
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stubPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "shims",
  "server-only-empty.js",
);

const mod = Module as typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeModule | null,
    isMain: boolean,
    options?: unknown,
  ) => string;
};

const originalResolveFilename = mod._resolveFilename.bind(Module);

mod._resolveFilename = function resolveFilename(
  request: string,
  parent: NodeModule | null,
  isMain: boolean,
  options?: unknown,
): string {
  if (request === "server-only") {
    return stubPath;
  }
  return originalResolveFilename(request, parent, isMain, options);
};
