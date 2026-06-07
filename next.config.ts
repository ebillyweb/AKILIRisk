import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { resolveGitBuildEnv } from "./src/lib/build/git-build-env";

/** Lockfiles under home (e.g. ~/package-lock.json) make Turbopack pick the wrong root; pin to this app. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Baked at build/dev start for /admin/operations (Vercel has no commit-date env). */
const nextConfig: NextConfig = {
  env: resolveGitBuildEnv({ cwd: projectRoot }),
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/auth/signin",
        destination: "/signin",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
