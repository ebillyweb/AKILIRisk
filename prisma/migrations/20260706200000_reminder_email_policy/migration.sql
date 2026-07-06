-- Allow enterprises and advisors to opt out of automated reminder emails.

ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "clientReminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorReminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AdvisorProfile"
  ADD COLUMN "clientReminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorReminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
