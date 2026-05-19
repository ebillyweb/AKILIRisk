import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Lockfiles under home (e.g. ~/package-lock.json) make Turbopack pick the wrong root; pin to this app. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function gitExec(command: string): string | undefined {
  try {
    return execSync(command, { encoding: "utf8", cwd: projectRoot }).trim();
  } catch {
    return undefined;
  }
}

/** Baked at build/dev start for /admin/operations (Vercel has no commit-date env). */
function buildGitEnv(): Record<string, string> {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? gitExec("git rev-parse HEAD");
  const ref =
    process.env.VERCEL_GIT_COMMIT_REF ??
    gitExec("git rev-parse --abbrev-ref HEAD");
  const date = sha
    ? gitExec(`git show -s --format=%cI ${sha}`)
    : gitExec("git show -s --format=%cI HEAD");

  const out: Record<string, string> = {};
  if (sha) out.BUILD_GIT_COMMIT_SHA = sha;
  if (ref) out.BUILD_GIT_COMMIT_REF = ref;
  if (date) out.BUILD_GIT_COMMIT_DATE = date;
  return out;
}

const nextConfig: NextConfig = {
  env: buildGitEnv(),
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
