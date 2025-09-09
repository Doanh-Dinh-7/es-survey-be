import { SurveyStatus, QuestionType, AutoCloseCondition } from '@prisma/client';

export interface BaseSurvey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  isTemplate: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  closedAt: Date | null;
  userId: string | null;
}

export interface SurveyWithRelations extends BaseSurvey {
  questions: Array<{
    id: string;
    questionText: string;
    type: QuestionType;
    isRequired: boolean;
    order: number;
    options: Array<{
      id: string;
      optionText: string;
    }>;
  }>;
  settings: {
    id: string;
    requireEmail: boolean;
    responseLetter: string | null;
    allowMultipleResponses: boolean;
    openTime: Date | null;
    closeTime: Date | null;
    maxResponse: number | null;
    autoCloseCondition: AutoCloseCondition;
  } | null;
}

export interface SurveyResponse {
  survey: SurveyWithRelations;
}

export interface SurveyListResponse {
  surveys: BaseSurvey[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface SurveySettingResponse {
  settings: {
    id: string;
    requireEmail: boolean;
    responseLetter: string | null;
    allowMultipleResponses: boolean;
    openTime: Date | null;
    closeTime: Date | null;
    maxResponse: number | null;
    autoCloseCondition: AutoCloseCondition;
  };
}