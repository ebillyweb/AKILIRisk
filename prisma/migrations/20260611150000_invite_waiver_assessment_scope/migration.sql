-- Epic 5.11: assessment scope on intake-waived invitations.
ALTER TABLE "InviteCode"
ADD COLUMN "included_pillars" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "focus_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
