import { PrismaClient, SurveyStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '../exceptions/http.exception';

const prisma = new PrismaClient();

export class ResponseService {
  static async getSurveyResponses(surveyId: string, userId: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: true
      }
    });
  
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.userId !== userId) throw new ForbiddenException('You are not allowed to view these responses');
  
    const responses = await prisma.response.findMany({
      where: { surveyId },
      include: {
        answers: {
          include: {
            question: true,
            options: {
              include: { option: true }
            }
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });
  
    const formattedResponses = responses.map((response) => {
      const formattedAnswers = response.answers.map((answer) => {
        let formattedAnswer: string | string[];
  
        switch (answer.question.type) {
          case 'checkbox':
            formattedAnswer = answer.options.map(o =>
              o.option?.isOther && o.customText
                ? `${o.option.optionText}: ${o.customText}`
                : o.option?.optionText || '[No answer]'
            );
            break;
  
          case 'multiple_choice':
            const option = answer.options[0];
            if (!option) {
              formattedAnswer = '[No answer]';
            } else {
              formattedAnswer =
                option.option?.isOther && option.customText
                  ? `${option.option.optionText}: ${option.customText}`
                  : option.option?.optionText || '[No answer]';
            }
            break;
  
          default:
            formattedAnswer = answer.answerText || '[Empty]';
        }
  
        return {
          questionId: answer.question.id,
          questionText: answer.question.questionText,
          type: answer.question.type,
          answer: formattedAnswer
        };
      });
  
      return {
        responseId: response.id,
        userEmail: response.userEmail,
        submittedAt: response.submittedAt,
        answers: formattedAnswers
      };
    });
  
    return {
      surveyId: survey.id,
      title: survey.title,
      responses: formattedResponses
    };
  }
  
  static async getSurveyResponseDetail(surveyId: string, responseId: string, userId: string): Promise<ResponseDetail[]> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: true
      }
    });

    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.userId !== userId) throw new ForbiddenException('Not your survey');

    const responses = await prisma.response.findMany({
      where: { surveyId, id: responseId },
      include: {
        answers: {
          include: {
            question: true,
            options: {
              include: { option: true }
            }
          }
        }
      },
    });

    const result = responses.map((response) => ({
      responseId: response.id,
      userEmail: response.userEmail,
      submittedAt: response.submittedAt,
      answers: response.answers.map((answer) => {
        let formattedAnswer: string | string[];

        switch (answer.question.type) {
          case 'multiple_choice':
            formattedAnswer = answer.options[0]?.option.optionText || '[No answer]';
            break;

          case 'checkbox':
            formattedAnswer = answer.options.map(o => o.option.optionText);
            break;

          default:
            formattedAnswer = answer.answerText || '[Empty]';
        }

        return {
          questionId: answer.question.id,
          questionText: answer.question.questionText,
          type: answer.question.type,
          answer: formattedAnswer
        };
      })
    }));

    return result;
  }

  static async getSurveyStatistics(surveyId: string, userId: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { include: { options: true } },
      }
    });

    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.userId !== userId) throw new ForbiddenException('Not your survey');

    const totalResponses = await prisma.response.count({ where: { surveyId } });

    const result = [];

    for (const question of survey.questions) {
      if (['multiple_choice', 'checkbox'].includes(question.type)) {
        // Count selected options
        const optionStats = await prisma.answerOption.groupBy({
          by: ['optionId', 'customText'],
          where: {
            answer: { questionId: question.id }
          },
          _count: true
        });

        // Tạo summary cho từng câu hỏi
        const questionSummary = question.options.map((opt) => {
          const matches = optionStats.filter(s => s.optionId === opt.id);
          const totalCount = matches.reduce((sum, m) => sum + m._count, 0);
          
          // Nếu là option khác, thêm thông tin về các câu trả lời tùy chỉnh
          const customAnswers = opt.isOther 
            ? matches
                .filter(m => m.customText)
                .map(m => ({
                  text: m.customText,
                  count: m._count,
                  percentage: totalResponses ? Math.round((m._count / totalResponses) * 100) : 0
                }))
                .sort((a, b) => b.count - a.count)
            : undefined;

          return {
            optionText: opt.optionText,
            count: totalCount,
            percentage: totalResponses ? Math.round((totalCount / totalResponses) * 100) : 0,
            customAnswers
          };
        });

        // Thêm kết quả vào mảng result
        result.push({
          questionId: question.id,
          questionText: question.questionText,
          type: question.type,
          summary: questionSummary,
          totalResponses
        });

      } else {
        // Text-based questions
        const answers = await prisma.answer.findMany({
          where: { questionId: question.id },
          select: { answerText: true }
        });

        const topAnswers: Record<string, number> = {};

        for (const { answerText } of answers) {
          if (!answerText) continue;
          topAnswers[answerText] = (topAnswers[answerText] || 0) + 1;
        }

        const sortedTop = Object.entries(topAnswers)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)

        result.push({
          questionId: question.id,
          questionText: question.questionText,
          type: question.type,
          summary: sortedTop,
          totalResponses
        });
      }
    }

    return {
      surveyId: survey.id,
      title: survey.title,
      description: survey.description,
      aiAnalysis: survey.aiAnalysis,
      status: survey.status,
      totalResponses,
      questions: result
    };
  }

  static async deleteResponse(surveyId: string, responseId: string, userId: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.userId !== userId) throw new ForbiddenException('Not your survey');

    await prisma.response.delete({
      where: { id: responseId, surveyId },
    });
  }
}