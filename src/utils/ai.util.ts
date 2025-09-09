import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { ResponseService } from "../services/response.service";

const prisma = new PrismaClient();
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
const MAX_TOKENS = 500;

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface AimLResponse {
  success: boolean;
  data: {
    text: string;
  };
}

export const enqueueAIAnalysisJob = async (
  surveyId: string,
  provider: "ollama" | "aiml" = "ollama"
) => {
  console.log(`🚀 Starting AI analysis for survey ${surveyId}`);
  try {
    // Get the survey and user ID
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, aiAnalysis: null },
      select: { userId: true },
    });

    if (!survey) {
      throw new Error("Survey not found or already analyzed");
    }

    if (!survey.userId) {
      throw new Error("Survey has no associated user");
    }

    // Get survey statistics
    const statistics = await ResponseService.getSurveyStatistics(
      surveyId,
      survey.userId
    );

    // Prepare the prompt
    const prompt =
      provider === "ollama"
        ? prepareAnalysisPrompt(statistics)
        : prepareAnalysisPromptAimL(statistics);

    // Generate analysis using Ollama
    const analysis = await generateAnalysis(prompt);

    // Save the analysis
    await prisma.survey.update({
      where: { id: surveyId },
      data: { aiAnalysis: analysis },
    });

    console.log("✅ AI analysis completed successfully");
    console.log(analysis);
    return analysis;
  } catch (error) {
    console.error("❌ Error in AI analysis:", error);
    throw error;
  }
};

const prepareAnalysisPrompt = (statistics: any) => {
  const { title, description, totalResponses, questions } = statistics;

  let promptOllama = `
  
You are a data analyst. I will provide you with a set of survey responses. Your task is to write a clear, concise summary report of around 200 words. Focus on key insights, trends, and patterns from the data. Avoid repeating details unnecessarily, and make sure the summary is easy to understand. Highlight the most important findings without going into excessive detail. End with a brief conclusion or recommendation.
    ### Survey Information:
    The survey title is: ${title}
    The survey description is: ${description}
    The total number of responses is: ${totalResponses}

    ### Survey Questions:
`;

  questions.forEach((question: any) => {
    promptOllama += `Question: ${question.questionText}\n`;
    promptOllama += `Type: ${question.type}\n`;

    if (question.summary) {
      promptOllama += "Response distribution:\n";
      question.summary.forEach((item: any) => {
        promptOllama += `- ${item.optionText}: ${item.count} responses (${item.percentage}%)\n`;
      });
    }

    if (question.topAnswers) {
      promptOllama += "Top text responses:\n";
      question.topAnswers.forEach((answer: any) => {
        promptOllama += `- "${answer.value}": ${answer.count} times\n`;
      });
    }

    promptOllama += "\n";
  });

  promptOllama +=
    "\nProvide a comprehensive analysis of the survey results, including:\n";
  promptOllama += "1. Key findings and patterns\n";
  promptOllama += "2. Notable trends in responses\n";
  promptOllama += "3. Recommendations based on the data\n";
  promptOllama +=
    "4. Any interesting correlations between different questions\n";

  return promptOllama;
};

const prepareAnalysisPromptAimL = (statistics: any) => {
  const { title, description, totalResponses, questions } = statistics;

  return `
    This is the survey data:

    Survey Title: ${title}
    Description: ${description}
    Total Responses: ${totalResponses}

    Questions and Responses:
    ${questions
      .map(
        (question: any) => `
    Question: ${question.questionText}
    Type: ${question.type}
    ${
      question.summary
        ? `Response Distribution:
    ${question.summary
      .map(
        (item: any) =>
          `- ${item.optionText}: ${item.count} responses (${item.percentage}%)`
      )
      .join("\n")}`
        : ""
    }
    ${
      question.topAnswers
        ? `Top Text Responses:
    ${question.topAnswers
      .map((answer: any) => `- "${answer.value}" (${answer.count} times)`)
      .join("\n")}`
        : ""
    }
    `
      )
      .join("\n")}
    `;
};

const generateAnalysis = async (prompt: string): Promise<string> => {
  try {
    const response = await axios.post<OllamaResponse>(
      `${OLLAMA_API_URL}/api/generate`,
      {
        model: "phi3:mini",
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: MAX_TOKENS,
        },
      }
    );

    console.log("Ollama response generated");

    return response.data.response;
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw new Error("Failed to generate AI analysis");
  }
};

const generateAimLAnalysis = async (prompt: string): Promise<string> => {
  try {
    const response = await axios.post<AimLResponse>(
      "https://api.aimlapi.com/v1",
      {
        message: [
          {
            role: "system",
            content: `You are a data analyst. The key is title and description of survey. I will provide you with a set of survey responses. Your task is to write a clear, concise summary report of around 200 words. Focus on key insights, trends, and patterns from the data. Avoid repeating details unnecessarily, and make sure the summary is easy to understand. Highlight the most important findings without going into excessive detail. End with a brief conclusion or recommendation.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: MAX_TOKENS,
        stream: true,
        temperature: 0.7,
        model: "openai/gpt-4.1-mini-2025-04-14", // or whatever model is available in AimL
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AIML_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.text;
  } catch (error) {
    console.error("Error calling AimL API:", error);
    throw new Error("Failed to generate AI analysis using AimL");
  }
};

export const analyzeSurvey = async (
  surveyId: string,
  provider: "ollama" | "aiml" = "ollama"
) => {
  console.log(
    `🚀 Starting AI analysis for survey ${surveyId} using ${provider}`
  );
  try {
    // Get the survey and user ID
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { userId: true },
    });

    if (!survey) {
      throw new Error("Survey not found");
    }

    if (!survey.userId) {
      throw new Error("Survey has no associated user");
    }

    // Get survey statistics
    const statistics = await ResponseService.getSurveyStatistics(
      surveyId,
      survey.userId
    );

    // Prepare the prompt
    const prompt =
      provider === "ollama"
        ? prepareAnalysisPrompt(statistics)
        : prepareAnalysisPromptAimL(statistics);

    // Generate analysis using selected provider
    const analysis =
      provider === "ollama"
        ? await generateAnalysis(prompt)
        : await generateAimLAnalysis(prompt);

    // Save the analysis
    await prisma.survey.update({
      where: { id: surveyId },
      data: { aiAnalysis: analysis },
    });

    console.log(`✅ AI analysis completed successfully using ${provider}`);
    console.log(analysis);
    return analysis;
  } catch (error) {
    console.error(`❌ Error in AI analysis using ${provider}:`, error);
    throw error;
  }
};
