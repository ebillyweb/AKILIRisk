-- Allow enterprise team members to skip intake when firm admin enables it.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberSkipIntakeEnabled" BOOLEAN NOT NULL DEFAULT false;
