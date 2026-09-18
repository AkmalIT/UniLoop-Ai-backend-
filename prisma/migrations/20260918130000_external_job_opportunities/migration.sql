ALTER TABLE "Opportunity"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "externalFetchedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Opportunity_externalId_key" ON "Opportunity"("externalId");
