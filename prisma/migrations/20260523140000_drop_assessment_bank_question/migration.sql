-- US-37 / Epic 5.5: pillar DDL (`questions`) is the sole question bank.
-- Seed with `npm run seed:pillar-ddl` before applying in environments that
-- still rely on AssessmentBankQuestion rows (they are not migrated automatically).

DROP TABLE IF EXISTS "AssessmentBankQuestion";
