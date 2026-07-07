-- Firm toggle: allow team members to request and track client document requirements.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberDocumentRequirementsEnabled" BOOLEAN NOT NULL DEFAULT true;
