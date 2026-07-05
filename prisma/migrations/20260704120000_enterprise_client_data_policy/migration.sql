-- Enterprise firm defaults for client labeling / intake collection.
ALTER TABLE "AdvisorEnterprise"
  ADD COLUMN "advisorMemberPseudonymousLabelingDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "advisorMemberCollectClientLegalNameDefault" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advisorMemberClientDataPolicyLocked" BOOLEAN NOT NULL DEFAULT false;

-- Pseudonymous client reference shown in advisor workspace (e.g. CL-8F3K-29QX).
ALTER TABLE "User"
  ADD COLUMN "clientReferenceCode" TEXT;

CREATE UNIQUE INDEX "User_clientReferenceCode_key" ON "User"("clientReferenceCode");
