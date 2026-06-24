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

# Preview builds share the same DB and often deploy concurrently; running migrate
# on every preview deploy contends on Prisma's advisory lock (P1002). Production
# is the single migration lane. Override with RUN_PRISMA_MIGRATE_DEPLOY=1.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  run_migrate_deploy
elif [ "${RUN_PRISMA_MIGRATE_DEPLOY:-}" = "1" ]; then
  echo "RUN_PRISMA_MIGRATE_DEPLOY=1: running prisma migrate deploy on VERCEL_ENV=${VERCEL_ENV:-local}" >&2
  run_migrate_deploy
else
  echo "Skipping prisma migrate deploy (VERCEL_ENV=${VERCEL_ENV:-local}; production only)." >&2
fi

npm run build
