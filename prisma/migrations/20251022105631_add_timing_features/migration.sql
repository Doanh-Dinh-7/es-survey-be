-- AlterTable
ALTER TABLE "public"."Response" ADD COLUMN     "sessionId" UUID;

-- AlterTable
ALTER TABLE "public"."SurveySetting" ADD COLUMN     "enableTiming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timingDuration" INTEGER;

-- CreateTable
CREATE TABLE "public"."SurveySession" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveySession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."SurveySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveySession" ADD CONSTRAINT "SurveySession_survey_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveySession" ADD CONSTRAINT "SurveySession_settings_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."SurveySetting"("surveyId") ON DELETE RESTRICT ON UPDATE CASCADE;
