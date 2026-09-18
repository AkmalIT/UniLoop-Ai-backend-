ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "StudentProfile"
  ADD COLUMN "university" TEXT,
  ADD COLUMN "faculty" TEXT,
  ADD COLUMN "major" TEXT,
  ADD COLUMN "studyYear" INTEGER,
  ADD COLUMN "bio" TEXT;

ALTER TABLE "ProfessorProfile"
  ADD COLUMN "university" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "expertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bio" TEXT;
