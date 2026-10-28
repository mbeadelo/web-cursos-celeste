Loaded Prisma config from prisma.config.ts.

-- CreateEnum
CREATE TYPE "OpsLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('CREATED', 'FAILED');

-- CreateTable
CREATE TABLE "OpsEvent" (
    "id" TEXT NOT NULL,
    "level" "OpsLevel" NOT NULL,
    "area" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "detail" JSONB,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OpsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "email" TEXT,
    "ip" TEXT,
    "stripeSessionId" TEXT,
    "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "error" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsEvent_fingerprint_resolvedAt_idx" ON "OpsEvent"("fingerprint", "resolvedAt");

-- CreateIndex
CREATE INDEX "OpsEvent_lastSeenAt_idx" ON "OpsEvent"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAttempt_stripeSessionId_key" ON "CheckoutAttempt"("stripeSessionId");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_createdAt_idx" ON "CheckoutAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "CheckoutAttempt_courseId_idx" ON "CheckoutAttempt"("courseId");

-- AddForeignKey
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
┌─────────────────────────────────────────────────────────┐
│  Update available 7.8.0 -> 8.0.0-rc.28                  │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

