import { execSync } from "node:child_process";

export type GitCommandRunner = (
  command: string,
  cwd: string
) => string | undefined;

export function defaultGitRunner(
  command: string,
  cwd: string
): string | undefined {
  try {
    return execSync(command, { encoding: "utf8", cwd, stdio: "pipe" }).trim();
  } catch {
    return undefined;
  }
}

const COMMIT_DATE_FORMAT = "%cI";

/**
 * Resolves BUILD_GIT_* vars baked into Next via `next.config` `env`.
 * Used by `/admin/operations` — Vercel exposes SHA/ref at runtime but not commit date.
 */
export function resolveGitBuildEnv(options: {
  cwd: string;
  env?: Record<string, string | undefined>;
  runGit?: GitCommandRunner;
}): Record<string, string> {
  const env = options.env ?? process.env;
  const runGit = options.runGit ?? defaultGitRunner;
  const { cwd } = options;

  const sha =
    trimEnv(env.VERCEL_GIT_COMMIT_SHA) ??
    trimEnv(env.BUILD_GIT_COMMIT_SHA) ??
    runGit("git rev-parse HEAD", cwd);

  const ref =
    trimEnv(env.VERCEL_GIT_COMMIT_REF) ??
    trimEnv(env.BUILD_GIT_COMMIT_REF) ??
    runGit("git rev-parse --abbrev-ref HEAD", cwd);

  const date =
    trimEnv(env.BUILD_GIT_COMMIT_DATE) ?? resolveCommitDate(sha, cwd, runGit);

  const out: Record<string, string> = {};
  if (sha) out.BUILD_GIT_COMMIT_SHA = sha;
  if (ref) out.BUILD_GIT_COMMIT_REF = ref;
  if (date) out.BUILD_GIT_COMMIT_DATE = date;
  return out;
}

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Try several git commands — Vercel builds sometimes lack objects for `git show <sha>`. */
function resolveCommitDate(
  sha: string | undefined,
  cwd: string,
  runGit: GitCommandRunner
): string | undefined {
  const fmt = COMMIT_DATE_FORMAT;

  if (sha) {
    return (
      runGit(`git show -s --format=${fmt} ${sha}`, cwd) ??
      runGit(`git log -1 --format=${fmt} ${sha}`, cwd) ??
      runGit(`git log -1 --format=${fmt} -n 1`, cwd) ??
      runGit(`git show -s --format=${fmt} HEAD`, cwd)
    );
  }

  return (
    runGit(`git show -s --format=${fmt} HEAD`, cwd) ??
    runGit(`git log -1 --format=${fmt} -n 1`, cwd)
  );
}
