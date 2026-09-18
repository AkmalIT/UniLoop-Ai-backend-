CREATE TYPE "ClubMembershipRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "ClubMembership" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "role" "ClubMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubMembership_opportunityId_studentId_key"
  ON "ClubMembership"("opportunityId", "studentId");
CREATE INDEX "ClubMembership_studentId_idx" ON "ClubMembership"("studentId");

ALTER TABLE "ClubMembership"
  ADD CONSTRAINT "ClubMembership_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubMembership"
  ADD CONSTRAINT "ClubMembership_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
