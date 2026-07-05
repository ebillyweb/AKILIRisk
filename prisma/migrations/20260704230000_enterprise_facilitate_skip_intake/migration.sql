-- Allow enterprise team members to skip post-intake review in live facilitated sessions.
-- Column renamed to advisorMemberSkipPostIntakeReviewEnabled in 20260704233000.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberFacilitateSkipIntakeEnabled" BOOLEAN NOT NULL DEFAULT false;
