#!/usr/bin/env bash
set -euo pipefail

run_migrate_deploy() {
  local max_attempts=3
  local retry_delay_seconds=15

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if npx prisma migrate deploy; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "prisma migrate deploy failed after ${max_attempts} attempts" >&2
      return 1
    fi

    echo "prisma migrate deploy failed (attempt ${attempt}/${max_attempts}); retrying in ${retry_delay_seconds}s..." >&2
    sleep "${retry_delay_seconds}"
  done
}

# Migration lanes:
#  - Production: the single controlled prod lane.
#  - Staging: the integration lane. Feature branches share ONE preview DB, so we
#    do NOT migrate on every preview deploy — an unreviewed/WIP migration on any
#    branch would mutate the shared DB before merge. Migrations reach the shared
#    preview DB only via `staging` (post-merge, reviewed), mirroring how they
#    reach prod via `main`.
# Both lanes are serialized deploys, so advisory-lock contention (P1002) is a
# non-issue; run_migrate_deploy also retries. Force anywhere with
# RUN_PRISMA_MIGRATE_DEPLOY=1.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  run_migrate_deploy
elif [ "${VERCEL_ENV:-}" = "preview" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" = "staging" ]; then
  echo "Staging integration lane: running prisma migrate deploy on the shared preview DB." >&2
  run_migrate_deploy
elif [ "${RUN_PRISMA_MIGRATE_DEPLOY:-}" = "1" ]; then
  echo "RUN_PRISMA_MIGRATE_DEPLOY=1: running prisma migrate deploy on VERCEL_ENV=${VERCEL_ENV:-local}" >&2
  run_migrate_deploy
else
  echo "Skipping prisma migrate deploy (VERCEL_ENV=${VERCEL_ENV:-local}, ref=${VERCEL_GIT_COMMIT_REF:-none}; production + staging lane only)." >&2
fi

npm run build
