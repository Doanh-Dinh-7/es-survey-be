/*
  Warnings:

  - The values [anonymous,login] on the enum `ParticipantMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ParticipantMode_new" AS ENUM ('internal', 'external');
ALTER TABLE "SurveySetting" ALTER COLUMN "participantMode" DROP DEFAULT;
ALTER TABLE "SurveySetting" ALTER COLUMN "participantMode" TYPE "ParticipantMode_new" USING ("participantMode"::text::"ParticipantMode_new");
ALTER TYPE "ParticipantMode" RENAME TO "ParticipantMode_old";
ALTER TYPE "ParticipantMode_new" RENAME TO "ParticipantMode";
DROP TYPE "ParticipantMode_old";
ALTER TABLE "SurveySetting" ALTER COLUMN "participantMode" SET DEFAULT 'external';
COMMIT;

-- AlterTable
ALTER TABLE "SurveySetting" ADD COLUMN     "allowMultipleResponses" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "participantMode" SET DEFAULT 'external';
