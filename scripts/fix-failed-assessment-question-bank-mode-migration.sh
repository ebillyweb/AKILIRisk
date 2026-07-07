#!/usr/bin/env bash
# Clear P3009 after a failed apply of 20260706120000_assessment_question_bank_mode
# (original SQL targeted snake_case tables; fixed to AdvisorProfile/AdvisorEnterprise),
# then re-run migrate deploy. Run from repo root with DATABASE_URL set.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Marking failed migration 20260706120000_assessment_question_bank_mode as rolled back..."
npx prisma migrate resolve --rolled-back "20260706120000_assessment_question_bank_mode"

echo "Applying migrations (assessment question bank mode migration is now idempotent)..."
npx prisma migrate deploy

echo "Done."
