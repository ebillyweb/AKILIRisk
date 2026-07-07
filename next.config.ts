import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { resolveGitBuildEnv } from "./src/lib/build/git-build-env";

/** Lockfiles under home (e.g. ~/package-lock.json) make Turbopack pick the wrong root; pin to this app. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Baked at build/dev start for /admin/operations (Vercel has no commit-date env). */
const nextConfig: NextConfig = {
  env: resolveGitBuildEnv({ cwd: projectRoot }),
  /** Pin NFT tracing to this app — avoids pulling sibling/home dirs when extra lockfiles exist. */
  outputFileTracingRoot: projectRoot,
  outputFileTracingExcludes: {
    "*": [
      "./test-results/**",
      "./playwright-report/**",
      "./blob-report/**",
      "./qa-screens/**",
      "./qa-temp/**",
      "./tests/**",
      "./docs/**",
      "./.planning/**",
      "./preview/**",
      "./Belvedere_Household_Risk_Profile.xlsx",
      "./*.docx",
      "./structure.txt",
      "./tsconfig.tsbuildinfo",
      "./public/uploads/**",
    ],
  },
  outputFileTracingIncludes: {
    "/api/templates/[id]": ["./templates/**/*"],
  },
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
      {
        source: "/advisor/methodology/pillars",
        destination: "/advisor/methodology/risk-domains",
        permanent: true,
      },
      {
        source: "/advisor/enterprise/methodology/pillars",
        destination: "/advisor/enterprise/methodology/risk-domains",
        permanent: true,
      },
      {
        source: "/admin/pillars",
        destination: "/admin/risk-domains",
        permanent: true,
      },
      {
        source: "/advisor/facilitate/:sessionId/pillars",
        destination: "/advisor/facilitate/:sessionId/risk-domains",
        permanent: true,
      },
      {
        source: "/api/platform/pillars",
        destination: "/api/platform/risk-domains",
        permanent: true,
      },
      {
        source: "/api/assessment/pillars/:path*",
        destination: "/api/assessment/risk-domains/:path*",
        permanent: true,
      },
      {
        source: "/api/advisor/methodology/pillars/:path*",
        destination: "/api/advisor/methodology/risk-domains/:path*",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "query", key: "audience", value: "families" }],
        destination: "/families",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "query", key: "audience", value: "advisors" }],
        destination: "/firms",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "query", key: "audience", value: "overview" }],
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/contact",
        has: [{ type: "query", key: "intent", value: "demo" }],
        destination: "/contact/demo",
        permanent: true,
      },
      {
        source: "/contact",
        has: [{ type: "query", key: "intent", value: "enterprise" }],
        destination: "/contact/enterprise",
        permanent: true,
      },
      {
        source: "/advisor/settings",
        has: [{ type: "query", key: "tab", value: "branding" }],
        destination: "/advisor/settings/branding",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
