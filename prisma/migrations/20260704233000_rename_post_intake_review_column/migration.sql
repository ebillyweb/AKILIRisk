-- Rename after post-intake review semantics replaced mistaken facilitated skip-intake naming.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AdvisorEnterprise'
      AND column_name = 'advisorMemberFacilitateSkipIntakeEnabled'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'AdvisorEnterprise'
      AND column_name = 'advisorMemberSkipPostIntakeReviewEnabled'
  ) THEN
    ALTER TABLE "AdvisorEnterprise"
      RENAME COLUMN "advisorMemberFacilitateSkipIntakeEnabled"
      TO "advisorMemberSkipPostIntakeReviewEnabled";
  END IF;
END $$;
