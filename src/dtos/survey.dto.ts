import { z } from "zod";

export const optionSchema = z.object({
  id: z.string().uuid().optional(),
  optionText: z.string().min(1, "Option text is required"),
  optionMediaUrl: z.string().nullable().optional(),
  isOther: z.boolean().optional(),
});

export const matrixRowSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "Row label is required"),
  order: z.number().int(),
});

export const matrixColumnSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "Column label is required"),
  order: z.number().int(),
});

export const questionSchema = z.object({
  id: z.string().uuid().optional(),
  questionText: z.string().min(1, "Question text is required"),
  type: z.enum([
    "short_text",
    "long_text",
    "multiple_choice",
    "checkbox",
    "matrix_choice",
    "matrix_input",
  ]),
  isRequired: z.boolean().optional(),
  order: z.number().int().optional(),
  options: z.array(optionSchema).optional(), // Only for choice/checkbox
  questionMediaUrl: z.string().nullable().optional(),
  matrixRows: z.array(matrixRowSchema).optional(), // Only for matrix types
  matrixColumns: z.array(matrixColumnSchema).optional(), // Only for matrix_choice
});

export const updateSurveySettingSchema = z.object({
  requireEmail: z.boolean().optional(),
  allowMultipleResponses: z.boolean().optional(),
  responseLetter: z.string().optional(),
  openTime: z.string().optional(), //2024-03-20T00:00:00Z
  closeTime: z.string().optional(),
  maxResponse: z.number().int().optional(),
  autoCloseCondition: z.enum(["manual", "by_time", "by_response"]).optional(),
});

export const createSurveySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  questions: z
    .array(questionSchema)
    .min(1, "At least one question is required"),
  settings: updateSurveySettingSchema.optional(),
  deletedOptionMediaUrls: z.array(z.string()).optional(),
  surveyMediaUrl: z.string().nullable().optional(),
});

export const updateSurveySchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  questions: z.array(questionSchema).optional(),
  settings: updateSurveySettingSchema.optional(),
  deletedOptionMediaUrls: z.array(z.string()).optional(),
  surveyMediaUrl: z.string().nullable().optional(),
});

export const matrixAnswerSchema = z.object({
  rowId: z.string().uuid(),
  columnId: z.string().uuid().optional(),
  inputValue: z.string().optional(),
});

export const submitSurveySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().min(1, "Answer is required"),
      customText: z.string().optional().or(z.literal("")),
      matrixAnswers: z.array(matrixAnswerSchema).optional(),
    })
  ),
  userEmail: z.string().email("Invalid email format").optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreateSurveyDto = z.infer<typeof createSurveySchema>;
export type UpdateSurveyDto = z.infer<typeof updateSurveySchema>;
export type UpdateSurveySettingDto = z.infer<typeof updateSurveySettingSchema>;
export type SubmitSurveyDto = z.infer<typeof submitSurveySchema>;
