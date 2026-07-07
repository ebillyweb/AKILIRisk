-- Enterprise team member personal branding policy (firm admin toggles).
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberPersonalBrandingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "advisorMemberSubdomainEditable" BOOLEAN NOT NULL DEFAULT false;
