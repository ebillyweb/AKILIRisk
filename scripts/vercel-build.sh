#!/usr/bin/env bash
set -euo pipefail

max_attempts=3
retry_delay_seconds=15

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  if npx prisma migrate deploy; then
    break
  fi

  if (( attempt == max_attempts )); then
    echo "prisma migrate deploy failed after ${max_attempts} attempts" >&2
    exit 1
  fi

  echo "prisma migrate deploy failed (attempt ${attempt}/${max_attempts}); retrying in ${retry_delay_seconds}s..." >&2
  sleep "${retry_delay_seconds}"
done

npm run build
