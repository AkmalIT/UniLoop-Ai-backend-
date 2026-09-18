ALTER TABLE "CareerProfile"
  ALTER COLUMN "targetRole" TYPE TEXT USING "targetRole"::TEXT,
  ADD COLUMN "coreSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "vacancyQueries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DROP TYPE "TargetRole";
