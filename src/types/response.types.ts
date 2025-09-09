type TransformedSurveyResponse = {
    id: string;
    questionText: string;
    type: string;
    answers: Array<{
      responseId: string;
      submittedAt: Date;
      answer: string | string[]; // for checkbox
    }>;
};


type ResponseDetail = {
  responseId: string;
  submittedAt: Date;
  answers: {
    questionId: string;
    questionText: string;
    type: string;
    answer: string | string[];
  }[];
};