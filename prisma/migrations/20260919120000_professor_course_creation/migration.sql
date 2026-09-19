-- Additive course-authoring fields. Existing courses remain drafts until a professor publishes them.
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CourseType" AS ENUM ('OFFICIAL', 'SUPPLEMENTARY', 'RECOMMENDED');
CREATE TYPE "EnrollmentMode" AS ENUM ('OPEN', 'APPROVAL_REQUIRED');
ALTER TYPE "AssessmentType" ADD VALUE IF NOT EXISTS 'FINAL_PREPARATION';

ALTER TABLE "Course"
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "fullDescription" TEXT,
  ADD COLUMN "type" "CourseType" NOT NULL DEFAULT 'OFFICIAL',
  ADD COLUMN "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "language" TEXT DEFAULT 'uz',
  ADD COLUMN "estimatedDurationMinutes" INTEGER,
  ADD COLUMN "weeklyWorkloadHours" INTEGER,
  ADD COLUMN "targetStudyYears" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "targetPrograms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "prerequisites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "careerRelevance" TEXT,
  ADD COLUMN "coverImageUrl" TEXT,
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "enrollmentMode" "EnrollmentMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  ADD COLUMN "maximumEnrollment" INTEGER;
CREATE INDEX "Course_status_idx" ON "Course"("status");

CREATE TABLE "CourseModule" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseModule_courseId_sortOrder_idx" ON "CourseModule"("courseId", "sortOrder");
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseTopic" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutes" INTEGER,
  "outcomeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseTopic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseTopic_moduleId_sortOrder_idx" ON "CourseTopic"("moduleId", "sortOrder");
ALTER TABLE "CourseTopic" ADD CONSTRAINT "CourseTopic_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseAiSuggestion" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "suggestion" JSONB NOT NULL,
  "provider" TEXT NOT NULL,
  "fallback" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseAiSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseAiSuggestion_courseId_createdAt_idx" ON "CourseAiSuggestion"("courseId", "createdAt");
ALTER TABLE "CourseAiSuggestion" ADD CONSTRAINT "CourseAiSuggestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningOutcome" ADD COLUMN "category" TEXT, ADD COLUMN "careerRelevance" TEXT, ADD COLUMN "aiSuggested" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "professorApprovedAt" TIMESTAMP(3);
ALTER TABLE "Material" ADD COLUMN "description" TEXT, ADD COLUMN "moduleId" TEXT, ADD COLUMN "outcomeId" TEXT, ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'ENROLLED';
CREATE INDEX "Material_moduleId_idx" ON "Material"("moduleId");
CREATE INDEX "Material_outcomeId_idx" ON "Material"("outcomeId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
