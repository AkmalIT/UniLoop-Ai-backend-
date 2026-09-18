-- CreateEnum
CREATE TYPE "TargetRole" AS ENUM ('FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'DATA_ANALYST', 'FULLSTACK_DEVELOPER', 'DEVOPS_ENGINEER');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('ASSESSMENT_MASTERY', 'ASSIGNMENT', 'PROJECT', 'PROFESSOR_VERIFICATION');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('PERSON', 'CLUB', 'PROJECT', 'JOB');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('NEW', 'VIEWED', 'INTERESTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CareerReadinessLevel" AS ENUM ('LEARNING_FOUNDATIONS', 'PROJECT_READY', 'INTERNSHIP_READY', 'JUNIOR_READY');

-- CreateEnum
CREATE TYPE "EndorsementStatus" AS ENUM ('PENDING', 'ENDORSED', 'NEEDS_DEVELOPMENT');

-- CreateTable
CREATE TABLE "CareerProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetRole" "TargetRole" NOT NULL,
    "interests" TEXT[],
    "availability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEvidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "professorVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRecommendation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "matchScore" DECIMAL(5,2) NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "explanationUz" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessorEndorsement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessorEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessorEndorsementItem" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "ProfessorEndorsementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "networkingVisible" BOOLEAN NOT NULL DEFAULT false,
    "professorReferralAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfile_studentId_key" ON "CareerProfile"("studentId");
CREATE INDEX "CareerProfile_targetRole_idx" ON "CareerProfile"("targetRole");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEvidence_studentId_skill_sourceType_sourceId_key" ON "SkillEvidence"("studentId", "skill", "sourceType", "sourceId");
CREATE INDEX "SkillEvidence_studentId_idx" ON "SkillEvidence"("studentId");
CREATE INDEX "SkillEvidence_skill_idx" ON "SkillEvidence"("skill");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRecommendation_studentId_opportunityId_key" ON "MatchRecommendation"("studentId", "opportunityId");
CREATE INDEX "MatchRecommendation_studentId_idx" ON "MatchRecommendation"("studentId");

-- CreateIndex
CREATE INDEX "ProfessorEndorsement_studentId_idx" ON "ProfessorEndorsement"("studentId");
CREATE INDEX "ProfessorEndorsement_professorId_idx" ON "ProfessorEndorsement"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorEndorsementItem_endorsementId_evidenceId_key" ON "ProfessorEndorsementItem"("endorsementId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_studentId_key" ON "Consent"("studentId");

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRecommendation" ADD CONSTRAINT "MatchRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRecommendation" ADD CONSTRAINT "MatchRecommendation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEndorsement" ADD CONSTRAINT "ProfessorEndorsement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEndorsement" ADD CONSTRAINT "ProfessorEndorsement_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "ProfessorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEndorsementItem" ADD CONSTRAINT "ProfessorEndorsementItem_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "ProfessorEndorsement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorEndorsementItem" ADD CONSTRAINT "ProfessorEndorsementItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "SkillEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
