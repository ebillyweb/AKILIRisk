#!/usr/bin/env bash
# Clear P3009 after a partial apply of 20260630233000_enterprise_advisor_assessment_leads_visibility,
# then re-run migrate deploy. Run from repo root with DATABASE_URL set.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Marking failed migration 20260630233000_enterprise_advisor_assessment_leads_visibility as rolled back..."
npx prisma migrate resolve --rolled-back "20260630233000_enterprise_advisor_assessment_leads_visibility"

echo "Applying migrations (assessment-leads migration is now idempotent)..."
npx prisma migrate deploy

echo "Done."
