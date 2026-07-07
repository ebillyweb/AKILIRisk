-- Hide tier-locked nav items from enterprise team members when firm enables it.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberHideTierLockedNav" BOOLEAN NOT NULL DEFAULT false;
