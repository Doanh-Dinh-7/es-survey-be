/*
  Warnings:

  - You are about to drop the column `participantMode` on the `SurveySetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[auth0Id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `auth0Id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AnswerOption" ADD COLUMN     "customText" TEXT;

-- AlterTable
ALTER TABLE "Option" ADD COLUMN     "isOther" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "auth0Id" TEXT,
ADD COLUMN     "userEmail" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SurveySetting" DROP COLUMN "participantMode",
ADD COLUMN     "requireEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "auth0Id" TEXT NOT NULL,
ADD COLUMN     "orgId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- DropEnum
DROP TYPE "ParticipantMode";

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Id_key" ON "User"("auth0Id");
