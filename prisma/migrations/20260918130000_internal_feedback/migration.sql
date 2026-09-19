CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FEATURE_REQUEST', 'USABILITY', 'CONTENT', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'PLANNED', 'RESOLVED');

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "FeedbackCategory" NOT NULL,
  "rating" INTEGER,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Feedback_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE INDEX "Feedback_status_category_idx" ON "Feedback"("status", "category");
