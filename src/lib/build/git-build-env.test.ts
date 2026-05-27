import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultGitRunner,
  resolveGitBuildEnv,
  type GitCommandRunner,
} from "@/lib/build/git-build-env";

const repoRoot = path.dirname(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
);

describe("resolveGitBuildEnv", () => {
  it("prefers explicit BUILD_GIT_COMMIT_DATE from env", () => {
    expect(
      resolveGitBuildEnv({
        cwd: repoRoot,
        env: {
          VERCEL_GIT_COMMIT_SHA: "abc123",
          BUILD_GIT_COMMIT_DATE: "2026-05-19T03:00:00.000Z",
        },
        runGit: () => undefined,
      })
    ).toEqual({
      BUILD_GIT_COMMIT_SHA: "abc123",
      BUILD_GIT_COMMIT_DATE: "2026-05-19T03:00:00.000Z",
    });
  });

  it("falls back through git commands when git show fails", () => {
    const calls: string[] = [];
    const runGit: GitCommandRunner = (command) => {
      calls.push(command);
      if (command.startsWith("git log -1")) {
        return "2026-05-20T12:00:00.000Z";
      }
      return undefined;
    };

    expect(
      resolveGitBuildEnv({
        cwd: repoRoot,
        env: { VERCEL_GIT_COMMIT_SHA: "deadbeef", VERCEL_GIT_COMMIT_REF: "main" },
        runGit,
      })
    ).toEqual({
      BUILD_GIT_COMMIT_SHA: "deadbeef",
      BUILD_GIT_COMMIT_REF: "main",
      BUILD_GIT_COMMIT_DATE: "2026-05-20T12:00:00.000Z",
    });

    expect(calls[0]).toBe("git show -s --format=%cI deadbeef");
    expect(calls.some((c) => c.startsWith("git log -1"))).toBe(true);
  });

  it("returns empty when git and env provide nothing", () => {
    expect(
      resolveGitBuildEnv({
        cwd: repoRoot,
        env: {},
        runGit: () => undefined,
      })
    ).toEqual({});
  });

  it("resolves from real git in the repo", () => {
    const out = resolveGitBuildEnv({
      cwd: repoRoot,
      env: {},
      runGit: defaultGitRunner,
    });
    expect(out.BUILD_GIT_COMMIT_SHA).toMatch(/^[0-9a-f]{40}$/i);
    expect(out.BUILD_GIT_COMMIT_REF).toBeTruthy();
    expect(out.BUILD_GIT_COMMIT_DATE).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
