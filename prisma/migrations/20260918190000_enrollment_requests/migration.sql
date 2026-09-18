CREATE TYPE "EnrollmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "EnrollmentRequest" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "EnrollmentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EnrollmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnrollmentRequest_courseId_studentId_key"
  ON "EnrollmentRequest"("courseId", "studentId");
CREATE INDEX "EnrollmentRequest_courseId_status_idx"
  ON "EnrollmentRequest"("courseId", "status");
CREATE INDEX "EnrollmentRequest_studentId_status_idx"
  ON "EnrollmentRequest"("studentId", "status");

ALTER TABLE "EnrollmentRequest"
  ADD CONSTRAINT "EnrollmentRequest_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentRequest"
  ADD CONSTRAINT "EnrollmentRequest_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
