import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root for `execSync("node scripts/...")` cwd (Playwright workers keep cwd at root, but this is explicit). */
export const PLAYWRIGHT_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
