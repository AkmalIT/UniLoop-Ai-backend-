-- Admin role already exists in UserRole. Add persistent club moderation state.
CREATE TYPE "ClubApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Opportunity"
  ADD COLUMN "approvalStatus" "ClubApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "creatorStudentId" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

CREATE INDEX "Opportunity_type_approvalStatus_idx" ON "Opportunity"("type", "approvalStatus");
CREATE INDEX "Opportunity_creatorStudentId_idx" ON "Opportunity"("creatorStudentId");

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_creatorStudentId_fkey"
  FOREIGN KEY ("creatorStudentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;