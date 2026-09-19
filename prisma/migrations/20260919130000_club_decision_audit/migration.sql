-- Keep an auditable record of the administrator who approved or rejected a club.
ALTER TABLE "Opportunity"
  ADD COLUMN "decidedByAdminId" TEXT;

CREATE INDEX "Opportunity_decidedByAdminId_idx"
  ON "Opportunity"("decidedByAdminId");

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_decidedByAdminId_fkey"
  FOREIGN KEY ("decidedByAdminId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
