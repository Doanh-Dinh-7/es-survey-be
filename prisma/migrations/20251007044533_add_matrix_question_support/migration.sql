-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."QuestionType" ADD VALUE 'matrix_choice';
ALTER TYPE "public"."QuestionType" ADD VALUE 'matrix_input';

-- CreateTable
CREATE TABLE "public"."MatrixAnswer" (
    "id" UUID NOT NULL,
    "answerId" UUID NOT NULL,
    "rowId" UUID NOT NULL,
    "columnId" UUID,
    "inputValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrixAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatrixRow" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrixRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatrixColumn" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrixColumn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."MatrixAnswer" ADD CONSTRAINT "MatrixAnswer_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "public"."Answer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrixAnswer" ADD CONSTRAINT "MatrixAnswer_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "public"."MatrixRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrixAnswer" ADD CONSTRAINT "MatrixAnswer_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "public"."MatrixColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrixRow" ADD CONSTRAINT "MatrixRow_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrixColumn" ADD CONSTRAINT "MatrixColumn_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
