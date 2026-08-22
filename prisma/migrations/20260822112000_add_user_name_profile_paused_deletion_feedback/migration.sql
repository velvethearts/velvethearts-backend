-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "isPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeletionFeedback" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detailedReason" TEXT,
    "metPartnerOnApp" BOOLEAN,
    "feedbackText" TEXT,
    "rating" INTEGER,
    "accountDurationDays" INTEGER,
    "userRole" TEXT DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeletionFeedback_reason_createdAt_idx" ON "DeletionFeedback"("reason", "createdAt");
