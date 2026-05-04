-- CreateEnum
CREATE TYPE "WebhookProcessStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCreated" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "WebhookProcessStatus" NOT NULL DEFAULT 'RECEIVED',

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_eventType_receivedAt_idx" ON "StripeWebhookEvent"("eventType", "receivedAt");

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "lastStripeEventAt" TIMESTAMP(3);
