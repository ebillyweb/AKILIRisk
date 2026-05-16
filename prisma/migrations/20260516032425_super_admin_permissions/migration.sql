/*
  Warnings:

  - Made the column `intakeWaived` on table `InviteCode` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `categories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "InviteCode" ALTER COLUMN "intakeWaived" SET NOT NULL;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "name" SET NOT NULL;

-- CreateIndex
CREATE INDEX "categories_display_order_idx" ON "categories"("display_order");

-- CreateIndex
CREATE INDEX "questions_answer_type_idx" ON "questions"("answer_type");

-- CreateIndex
CREATE INDEX "sections_display_order_idx" ON "sections"("display_order");
