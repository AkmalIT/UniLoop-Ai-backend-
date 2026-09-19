-- Legacy student-created clubs were stored without creatorStudentId and relied on
-- the default approved status. Recover their creator and require moderation.
UPDATE "Opportunity" AS opportunity
SET
  "creatorStudentId" = student.id,
  "approvalStatus" = 'PENDING'
FROM "StudentProfile" AS student
WHERE opportunity."type" = 'CLUB'
  AND opportunity."source" = 'STUDENT_CLUB'
  AND opportunity."creatorStudentId" IS NULL
  AND opportunity."relatedUserId" = student."userId";
