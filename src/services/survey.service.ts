import {
  PrismaClient,
  SurveyStatus,
  Question,
  Option,
  QuestionType,
  AutoCloseCondition,
} from "@prisma/client";
import {
  CreateSurveyDto,
  SubmitSurveyDto,
  UpdateSurveyDto,
  UpdateSurveySettingDto,
  StartSessionDto,
  ValidateSessionDto,
} from "../dtos/survey.dto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "../exceptions/http.exception";
import {
  BaseSurvey,
  SurveyResponse,
  SurveyListResponse,
  SurveySettingResponse,
  SurveyWithRelations,
} from "../types/survey.types";
import { enqueueAIAnalysisJob } from "../utils/ai.util";
import { getIO } from "../sockets/index";
import { ResponseService } from "./response.service";
import {
  notifyNewSurvey,
  notifySurveyClosed,
  notifySurveyClosedToOwner,
} from "../slack/handlers/surveyHandlers";
import { MediaService } from "./media.service";
import { sendSlackNotification } from "../utils/webhook.util";
import { slackApp } from "../slack/config";
import { createNewSurveyMessage } from "../slack/templates/messageTemplates";

const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "stdout",
      level: "error",
    },
    {
      emit: "stdout",
      level: "info",
    },
    {
      emit: "stdout",
      level: "warn",
    },
  ],
});

// prisma.$on('query', (e) => {
//   console.log('Query: ' + e.query)
//   console.log('Params: ' + e.params)
// })

interface QuestionWithOptions {
  id?: string;
  questionText: string;
  questionMediaUrl?: string;
  type: QuestionType;
  isRequired?: boolean;
  order?: number;
  options?: Array<{
    id?: string;
    optionText: string;
    optionMediaUrl?: string;
    isOther?: boolean;
  }>;
  matrixRows?: Array<{
    id?: string;
    label: string;
    order: number;
  }>;
  matrixColumns?: Array<{
    id?: string;
    label: string;
    order: number;
  }>;
}

export class SurveyService {
  static async createSurvey(
    data: CreateSurveyDto,
    userId: string
  ): Promise<SurveyWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Xoá media nếu có
      if (Array.isArray(data.deletedOptionMediaUrls)) {
        for (const url of data.deletedOptionMediaUrls) {
          try {
            await MediaService.deleteMedia(url);
          } catch (e) {
            // Log lỗi nhưng không throw để không chặn việc tạo survey
            console.error("Error deleting media:", url, e);
          }
        }
      }

      // Duplicate surveyMediaUrl nếu có
      let surveyMediaUrl = data.surveyMediaUrl ?? null;
      if (surveyMediaUrl) {
        surveyMediaUrl = await MediaService.duplicateMedia(surveyMediaUrl);
      }

      // Duplicate questionMediaUrl và optionMediaUrl nếu có
      const questions = await Promise.all(
        data.questions.map(async (q, idx) => {
          let questionMediaUrl = q.questionMediaUrl ?? null;
          if (questionMediaUrl) {
            questionMediaUrl = await MediaService.duplicateMedia(
              questionMediaUrl
            );
          }
          const options = q.options
            ? await Promise.all(
                q.options.map(async (o) => {
                  let optionMediaUrl = o.optionMediaUrl ?? null;
                  if (optionMediaUrl) {
                    optionMediaUrl = await MediaService.duplicateMedia(
                      optionMediaUrl
                    );
                  }
                  return {
                    optionText: o.optionText,
                    optionMediaUrl,
                    isOther: o.isOther ?? false,
                  };
                })
              )
            : undefined;
          // Xử lý matrix data
          const matrixRows = q.matrixRows?.map((row) => ({
            label: row.label,
            order: row.order,
          }));

          const matrixColumns = q.matrixColumns?.map((col) => ({
            label: col.label,
            order: col.order,
          }));

          return {
            questionText: q.questionText,
            questionMediaUrl,
            type: q.type,
            isRequired: q.isRequired ?? false,
            order: q.order ?? idx + 1,
            options: options ? { create: options } : undefined,
            matrixRows: matrixRows ? { create: matrixRows } : undefined,
            matrixColumns: matrixColumns
              ? { create: matrixColumns }
              : undefined,
          };
        })
      );

      const survey = await tx.survey.create({
        data: {
          title: data.title,
          description: data.description,
          surveyMediaUrl,
          status: SurveyStatus.PENDING,
          userId,
          questions: { create: questions },
          settings: {
            create: {
              requireEmail: data.settings?.requireEmail,
              responseLetter: data.settings?.responseLetter,
              openTime: data.settings?.openTime,
              closeTime: data.settings?.closeTime,
              maxResponse: data.settings?.maxResponse,
              autoCloseCondition: data.settings?.autoCloseCondition,
              allowMultipleResponses: data.settings?.allowMultipleResponses,
              enableTiming: data.settings?.enableTiming,
              timingDuration: data.settings?.timingDuration,
            },
          },
        },
        include: {
          questions: {
            include: {
              options: true,
              matrixRows: true,
              matrixColumns: true,
            },
          },
          settings: true,
        },
      });
      console.log(
        "🔥 Survey created:",
        survey.questions.map((q) => q.options)
      );
      return { ...survey, userId: survey.userId! };
    });
  }

  static async getSurveyDetail(
    surveyId: string,
    userId: string
  ): Promise<SurveyResponse> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
          },
        },
        settings: true,
      },
    });

    if (!survey)
      throw new NotFoundException("Survey not found", [
        { field: "surveyId", message: "Survey ID not found" },
      ]);
    if (survey.userId !== userId) throw new ForbiddenException("Access denied");

    return { survey: { ...survey, userId: survey.userId! } };
  }

  static async getMySurveysByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 9
  ): Promise<SurveyListResponse> {
    const skip = (page - 1) * pageSize;

    const [surveys, total] = await Promise.all([
      prisma.survey.findMany({
        where: {
          userId: userId,
          isTemplate: false,
        },
        include: {
          _count: { select: { responses: true } },
          settings: true,
        },
        take: pageSize,
        skip: skip,
        orderBy: { createdAt: "desc" },
      }),
      prisma.survey.count({
        where: {
          userId: userId,
          isTemplate: false,
        },
      }),
    ]);

    return {
      surveys: surveys.map((survey) => ({
        ...survey,
        userId: survey.userId!,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  static async updateSurvey(
    surveyId: string,
    data: UpdateSurveyDto,
    userId: string
  ): Promise<SurveyWithRelations> {
    // Xoá media nếu có
    if (Array.isArray(data.deletedOptionMediaUrls)) {
      for (const url of data.deletedOptionMediaUrls) {
        try {
          await MediaService.deleteMedia(url);
        } catch (e) {
          // Log lỗi nhưng không throw để không chặn việc update survey
          console.error("Error deleting media:", url, e);
        }
      }
    }
    // First get existing survey to check ownership and get current questions/options
    const existingSurvey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
          },
        },
        settings: true,
      },
    });

    if (!existingSurvey) throw new NotFoundException("Survey not found");
    if (existingSurvey.userId !== userId)
      throw new ForbiddenException("Access denied");
    if (existingSurvey.status !== SurveyStatus.PENDING)
      throw new BadRequestException("Only pending surveys can be updated");

    // Get IDs of questions and options that should be kept
    const questionIdsToKeep =
      data.questions
        ?.map((q) => q.id)
        .filter((id): id is string => id !== undefined) || [];
    const optionIdsToKeep =
      data.questions?.flatMap(
        (q) =>
          q.options
            ?.map((o) => o.id)
            .filter((id): id is string => id !== undefined) || []
      ) || [];

    // First delete options of questions that will be deleted
    const questionsToDelete = existingSurvey.questions.filter(
      (q) => !questionIdsToKeep.includes(q.id)
    );
    for (const question of questionsToDelete) {
      await prisma.option.deleteMany({
        where: { questionId: question.id },
      });
      await prisma.matrixRow.deleteMany({
        where: { questionId: question.id },
      });
      await prisma.matrixColumn.deleteMany({
        where: { questionId: question.id },
      });
    }

    try {
      const survey = await prisma.survey.update({
        where: { id: surveyId, userId: userId },
        data: {
          title: data.title,
          description: data.description,
          surveyMediaUrl: data.surveyMediaUrl ?? null,
          questions: {
            // Delete questions not in the request
            deleteMany: {
              id: {
                notIn: questionIdsToKeep,
              },
            },
            // Update existing questions
            update: data.questions
              ?.filter(
                (q): q is QuestionWithOptions & { id: string } =>
                  q.id !== undefined
              )
              .map((q) => ({
                where: { id: q.id },
                data: {
                  questionText: q.questionText,
                  questionMediaUrl: q.questionMediaUrl ?? null,
                  type: q.type,
                  isRequired: q.isRequired ?? false,
                  order: q.order ?? 0,
                  options: {
                    deleteMany: {
                      id: {
                        notIn:
                          q.options
                            ?.map((o) => o.id)
                            .filter((id): id is string => id !== undefined) ||
                          [],
                      },
                    },
                    update: q.options
                      ?.filter(
                        (
                          o
                        ): o is {
                          id: string;
                          optionText: string;
                          optionMediaUrl?: string;
                          isOther?: boolean;
                        } => o.id !== undefined
                      )
                      .map((o) => ({
                        where: { id: o.id },
                        data: {
                          optionText: o.optionText,
                          optionMediaUrl: o.optionMediaUrl ?? null,
                          isOther: o.isOther ?? false,
                        },
                      })),
                    create: q.options
                      ?.filter(
                        (
                          o
                        ): o is {
                          id: undefined;
                          optionText: string;
                          optionMediaUrl?: string;
                          isOther?: boolean;
                        } => o.id === undefined
                      )
                      .map((o) => ({
                        optionText: o.optionText,
                        optionMediaUrl: o.optionMediaUrl ?? null,
                        isOther: o.isOther ?? false,
                      })),
                  },

                  matrixRows: q.matrixRows
                    ? {
                        deleteMany: {},
                        create: q.matrixRows.map((row) => ({
                          label: row.label,
                          order: row.order,
                        })),
                      }
                    : undefined,

                  matrixColumns: q.matrixColumns
                    ? {
                        deleteMany: {},
                        create: q.matrixColumns.map((col) => ({
                          label: col.label,
                          order: col.order,
                        })),
                      }
                    : undefined,
                },
              })),
            // Create new questions
            create: data.questions
              ?.filter(
                (q): q is QuestionWithOptions & { id: undefined } =>
                  q.id === undefined
              )
              .map((q) => ({
                questionText: q.questionText,
                questionMediaUrl: q.questionMediaUrl ?? null,
                type: q.type,
                isRequired: q.isRequired ?? false,
                order: q.order ?? 0,
                options: {
                  create: q.options?.map((o) => ({
                    optionText: o.optionText,
                    isOther: o.isOther ?? false,
                  })),
                },
                matrixRows: q.matrixRows
                  ? {
                      create: q.matrixRows.map((row) => ({
                        label: row.label,
                        order: row.order,
                      })),
                    }
                  : undefined,
                matrixColumns: q.matrixColumns
                  ? {
                      create: q.matrixColumns.map((col) => ({
                        label: col.label,
                        order: col.order,
                      })),
                    }
                  : undefined,
              })),
          },
          settings: {
            update: data.settings,
          },
        },
        include: {
          questions: {
            include: {
              options: true,
              matrixRows: true,
              matrixColumns: true,
            },
          },
          settings: true,
        },
      });
      console.log("🔥 Survey updated:", survey);
      return { ...survey, userId: survey.userId! };
    } catch (error) {
      throw new InternalServerErrorException("Failed to update survey");
    }
  }

  static async deleteSurvey(surveyId: string, userId: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, userId: userId },
      include: {
        settings: true,
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
            answers: {
              include: {
                options: true,
                matrixCells: true,
              },
            },
          },
        },
        responses: true,
      },
    });

    if (!survey)
      throw new NotFoundException("Failed to delete survey", [
        { field: "surveyId", message: "Survey ID not found" },
      ]);

    // if (survey.status == SurveyStatus.PUBLISHED) {
    //   throw new BadRequestException("Cannot delete published survey");
    // }

    // Xóa các file media vật lý liên quan trước khi xóa bản ghi
    try {
      if (survey.surveyMediaUrl) {
        await MediaService.deleteMedia(survey.surveyMediaUrl);
      }
      for (const question of survey.questions) {
        if (question.questionMediaUrl) {
          await MediaService.deleteMedia(question.questionMediaUrl);
        }
        for (const option of question.options) {
          if (option.optionMediaUrl) {
            await MediaService.deleteMedia(option.optionMediaUrl);
          }
        }
      }
    } catch (e) {
      // Log lỗi nhưng không throw để không chặn việc xóa survey
      console.error("Error deleting media file when deleting survey:", e);
    }

    // Delete in transaction to ensure all related records are deleted
    await prisma.$transaction(async (tx) => {
      // Delete matrix answers first (they reference answers, rows, columns)
      for (const question of survey.questions) {
        for (const answer of question.answers) {
          await tx.matrixAnswer.deleteMany({
            where: { answerId: answer.id },
          });
        }
      }

      // Delete answer options (they reference answers)
      for (const question of survey.questions) {
        for (const answer of question.answers) {
          await tx.answerOption.deleteMany({
            where: { answerId: answer.id },
          });
        }
      }

      // Delete answers
      for (const question of survey.questions) {
        await tx.answer.deleteMany({
          where: { questionId: question.id },
        });
      }

      // Delete options
      for (const question of survey.questions) {
        await tx.option.deleteMany({
          where: { questionId: question.id },
        });
      }

      // Delete matrix rows and columns
      for (const question of survey.questions) {
        await tx.matrixRow.deleteMany({
          where: { questionId: question.id },
        });
        await tx.matrixColumn.deleteMany({
          where: { questionId: question.id },
        });
      }

      // Delete questions
      await tx.question.deleteMany({
        where: { surveyId: surveyId },
      });

      // Delete settings
      if (survey.settings) {
        await tx.surveySetting.delete({
          where: { surveyId: surveyId },
        });
      }

      // Delete responses
      await tx.response.deleteMany({
        where: { surveyId: surveyId },
      });

      // Finally delete the survey
      await tx.survey.delete({
        where: { id: surveyId },
      });
    });

    return { message: "Survey deleted successfully" };
  }

  static async toggleSurveyStatus(
    surveyId: string,
    userId: string,
    channelsFromFE?: string[],
    customMessage?: string
  ): Promise<BaseSurvey> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, userId: userId },
      include: {
        settings: true,
        user: true,
      },
    });

    if (!survey) {
      throw new NotFoundException("Survey not found", [
        { field: "surveyId", message: "Survey ID not found" },
      ]);
    }

    let updateStatus;
    if (survey.status === SurveyStatus.PENDING) {
      updateStatus = SurveyStatus.PUBLISHED;
    } else if (survey.status === SurveyStatus.PUBLISHED) {
      updateStatus = SurveyStatus.CLOSED;
    } else {
      throw new ForbiddenException("Survey already close");
    }

    // Chuyển sang PUBLISHED
    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId, userId: userId },
      data: {
        status: updateStatus,
        publishedAt: new Date(),
        settings: {
          update: {
            openTime: new Date(),
          },
        },
      },
      include: {
        settings: true,
        user: true,
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    // Đảm bảo dữ liệu nhất quán cho Slack notifications
    const surveyForNotification = {
      ...updatedSurvey,
      closeAt: updatedSurvey.settings?.closeTime || updatedSurvey.closedAt,
      publishedAt:
        updatedSurvey.publishedAt || updatedSurvey.settings?.openTime,
    };

    const channels = channelsFromFE?.length
      ? channelsFromFE
      : [`${process.env.SLACK_MAIN_CHANNEL_ID}`];
    if (updateStatus == SurveyStatus.PUBLISHED) {
      await notifyNewSurvey(surveyForNotification, channels, customMessage);
    } else {
      await notifySurveyClosed(surveyForNotification, channels);
    }

    return { ...updatedSurvey, userId: updatedSurvey.userId! };
  }

  static async getPublishedSurveyDetail(surveyId: string, userId?: string) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, status: SurveyStatus.PUBLISHED },
      include: {
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
          },
        },
        settings: true,
      },
    });

    if (!survey)
      throw new NotFoundException("Survey not found or not published");

    // For anonymous surveys, return without user info
    return {
      ...survey,
      hasSubmitted: false,
    };
  }

  static async cloneSurvey(surveyId: string, userId: string) {
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
        OR: [{ userId: userId }, { isTemplate: true }],
      },
      include: {
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
          },
        },
        settings: true,
      },
    });
    if (!survey) {
      throw new NotFoundException("Survey not found", [
        { field: "surveyId", message: "Survey ID not found" },
      ]);
    }

    console.log("survey:", survey);
    // Duplicate surveyMediaUrl nếu có
    let surveyMediaUrl = survey.surveyMediaUrl ?? null;
    if (surveyMediaUrl) {
      surveyMediaUrl = await MediaService.duplicateMedia(surveyMediaUrl);
    }

    // Duplicate questionMediaUrl và optionMediaUrl nếu có
    const questions = await Promise.all(
      survey.questions.map(async (q, idx) => {
        let questionMediaUrl = q.questionMediaUrl ?? null;
        if (questionMediaUrl) {
          questionMediaUrl = await MediaService.duplicateMedia(
            questionMediaUrl
          );
        }
        const options = q.options
          ? await Promise.all(
              q.options.map(async (o) => {
                let optionMediaUrl = o.optionMediaUrl ?? null;
                if (optionMediaUrl) {
                  optionMediaUrl = await MediaService.duplicateMedia(
                    optionMediaUrl
                  );
                }
                return {
                  optionText: o.optionText,
                  optionMediaUrl,
                  isOther: o.isOther ?? false,
                };
              })
            )
          : undefined;
        const matrixRows = q.matrixRows?.map((row) => ({
          label: row.label,
          order: row.order,
        }));

        const matrixColumns = q.matrixColumns?.map((col) => ({
          label: col.label,
          order: col.order,
        }));

        return {
          questionText: q.questionText,
          questionMediaUrl,
          type: q.type,
          isRequired: q.isRequired ?? false,
          order: q.order ?? idx + 1,
          options: options ? { create: options } : undefined,
          matrixRows: matrixRows ? { create: matrixRows } : undefined,
          matrixColumns: matrixColumns ? { create: matrixColumns } : undefined,
        };
      })
    );

    const clonedSurvey = await prisma.survey.create({
      data: {
        title: "(Copy) " + survey.title,
        description: survey.description,
        surveyMediaUrl,
        status: SurveyStatus.PENDING,
        userId: userId,
        questions: {
          create: questions,
        },
        settings: {
          create: {
            requireEmail: survey.settings?.requireEmail,
            responseLetter: survey.settings?.responseLetter,
            openTime: survey.settings?.openTime,
            closeTime: survey.settings?.closeTime,
            maxResponse: survey.settings?.maxResponse,
            autoCloseCondition: survey.settings?.autoCloseCondition,
            allowMultipleResponses: survey.settings?.allowMultipleResponses,
          },
        },
      },
    });
    return clonedSurvey;
  }

  static async updateSurveySetting(
    surveyId: string,
    data: UpdateSurveySettingDto,
    userId: string
  ): Promise<BaseSurvey> {
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
        userId: userId,
        status: { in: [SurveyStatus.PENDING, SurveyStatus.PUBLISHED] },
      },
      include: {
        settings: true,
      },
    });
    if (!survey)
      throw new NotFoundException("Survey not found or closed!", [
        {
          field: "surveyId",
          message: "Survey ID not found for satisified condition",
        },
        { field: "status", message: "Survey status might not be pending" },
      ]);

    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId, userId: userId },
      data: {
        settings: {
          update: {
            requireEmail: data.requireEmail,
            allowMultipleResponses: data.allowMultipleResponses,
            openTime: data.openTime,
            closeTime: data.closeTime,
            maxResponse: data.maxResponse,
            autoCloseCondition: data.autoCloseCondition as AutoCloseCondition,
            responseLetter: data.responseLetter,
            enableTiming: data.enableTiming,
            timingDuration: data.timingDuration,
          },
        },
      },
      include: {
        settings: true,
      },
    });
    return {
      ...updatedSurvey,
      userId: updatedSurvey.userId!,
    };
  }

  static async submitSurvey(
    surveyId: string,
    data: SubmitSurveyDto,
    userId?: string,
    auth0Id?: string
  ) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, status: SurveyStatus.PUBLISHED },
      include: {
        settings: true,
        questions: {
          include: {
            options: true,
            matrixRows: true,
            matrixColumns: true,
          },
        },
        _count: { select: { responses: true } },
      },
    });

    if (!survey) {
      throw new NotFoundException("Survey not found or not published");
    }

    // Check response limit (soft)
    const currentCount = survey._count.responses;
    const max = survey.settings?.maxResponse;
    if (max && currentCount >= max) {
      throw new ConflictException("Survey has reached its response limit");
    }

    if (survey.settings?.requireEmail && !data.userEmail) {
      throw new BadRequestException("Email is required");
    }

    // Timing validation
    if (survey.settings?.enableTiming) {
      if (!data.sessionId) {
        throw new BadRequestException(
          "Session ID is required for timed surveys"
        );
      }

      // Validate session
      const sessionValidation = await this.validateTimingSession(surveyId, {
        sessionId: data.sessionId,
      });
      if (!sessionValidation.isValid) {
        throw new BadRequestException(
          sessionValidation.message || "Session has expired"
        );
      }
    }

    // Check if user has already submitted (if allowMultipleResponses is false)
    if (!survey.settings?.allowMultipleResponses) {
      const existingResponse = await prisma.response.findFirst({
        where: {
          surveyId,
          userEmail: data.userEmail,
        },
      });
      if (existingResponse) {
        throw new ConflictException("You have already submitted this survey");
      }
    }

    // Validate answers
    for (const question of survey.questions) {
      const submitted = data.answers.find((a) => a.questionId === question.id);

      if (question.isRequired && !submitted) {
        throw new BadRequestException(`Question ${question.id} is required`);
      }

      if (submitted) {
        switch (question.type) {
          case QuestionType.multiple_choice:
            const selectedId = submitted.answer;
            const selectedOption = question.options.find(
              (opt) => opt.id === selectedId
            );

            if (submitted.answer.includes(",")) {
              throw new ConflictException(
                "Can not submit more than 1 option for this question",
                [
                  {
                    field: "questionId",
                    message: `This questionId : ${question.id} is multiple choice`,
                  },
                ]
              );
            }

            if (!question.options.some((opt) => opt.id === selectedId)) {
              throw new BadRequestException(
                `Invalid option for question ${question.id}`
              );
            }

            // Kiểm tra nếu là option tùy chỉnh thì phải có customText
            if (selectedOption?.isOther && !submitted.customText) {
              submitted.customText = "";
            }

            break;

          case QuestionType.checkbox:
            const optionIds = submitted.answer.split(",");
            const hasOtherOption = optionIds.some((id: string) => {
              const option = question.options.find((opt) => opt.id === id);
              return option?.isOther;
            });

            // Kiểm tra nếu có chọn option khác thì phải có customText
            if (hasOtherOption && !submitted.customText) {
              submitted.customText = "";
            }

            const allValid = optionIds.every((id: string) =>
              question.options.some((opt) => opt.id === id)
            );
            if (!allValid) {
              throw new BadRequestException(
                `Invalid checkbox options for question ${question.id}`
              );
            }
            break;

          case QuestionType.matrix_choice:
            if (submitted.matrixAnswers) {
              // Validate matrix choice answers
              for (const matrixAnswer of submitted.matrixAnswers) {
                const row = question.matrixRows?.find(
                  (r) => r.id === matrixAnswer.rowId
                );
                const column = question.matrixColumns?.find(
                  (c) => c.id === matrixAnswer.columnId
                );

                if (!row || !column) {
                  throw new BadRequestException(
                    `Invalid matrix answer for question ${question.id}`
                  );
                }
              }
            }
            break;

          case QuestionType.matrix_input:
            if (submitted.matrixAnswers) {
              // Validate matrix input answers
              for (const matrixAnswer of submitted.matrixAnswers) {
                const row = question.matrixRows?.find(
                  (r) => r.id === matrixAnswer.rowId
                );

                if (!row || !matrixAnswer.inputValue?.trim()) {
                  throw new BadRequestException(
                    `Matrix input required for question ${question.id}`
                  );
                }
              }
            }
            break;

          // optional: handle short_text / long_text min/max length
        }
      }
    }

    // Save with transaction
    await prisma.$transaction(async (tx) => {
      const response = await tx.response.create({
        data: {
          surveyId,
          userId,
          auth0Id,
          userEmail: data.userEmail,
          sessionId: data.sessionId,
          answers: {
            create: data.answers.map((a) => {
              const question = survey.questions.find(
                (q) => q.id === a.questionId
              )!;
              const isChoiceOrMatrix = [
                "multiple_choice",
                "checkbox",
                "matrix_choice",
                "matrix_input",
              ].includes(question.type);

              const answerData: any = {
                questionId: a.questionId,
                answerText: isChoiceOrMatrix
                  ? null
                  : typeof a.answer === "string"
                  ? a.answer
                  : null,
              };

              // If it's a choice-type, add selected options
              if (question.type === "multiple_choice") {
                const selectedId =
                  typeof a.answer === "string"
                    ? a.answer
                    : Object.keys(a.answer)[0];
                answerData.options = {
                  create: [
                    {
                      optionId: selectedId,
                      customText: a.customText, // Custom text
                    },
                  ],
                };
              }

              if (question.type === "checkbox") {
                let optionIds: string[];
                if (typeof a.answer === "string") {
                  optionIds = a.answer.split(",");
                } else if (typeof a.answer === "object" && a.answer !== null) {
                  optionIds = Object.keys(a.answer);
                } else {
                  optionIds = [];
                }

                answerData.options = {
                  create: optionIds.map((id) => ({
                    optionId: id,
                    customText: a.customText, // Custom text
                  })),
                };
              }

              // Handle matrix questions
              if (
                question.type === "matrix_choice" ||
                question.type === "matrix_input"
              ) {
                if (a.matrixAnswers && a.matrixAnswers.length > 0) {
                  answerData.matrixCells = {
                    create: a.matrixAnswers.map((matrixAnswer) => ({
                      rowId: matrixAnswer.rowId,
                      columnId: matrixAnswer.columnId,
                      inputValue: matrixAnswer.inputValue,
                    })),
                  };
                } else if (typeof a.answer === "object" && a.answer !== null) {
                  const matrixCells = Object.entries(a.answer).map(
                    ([key, value]) => {
                      if (question.type === "matrix_choice") {
                        return {
                          rowId: key,
                          columnId:
                            typeof value === "string" ? value : String(value),
                          inputValue: null,
                        };
                      } else {
                        const [rowId, columnId] = key.split("_");
                        return {
                          rowId: rowId,
                          columnId: columnId,
                          inputValue:
                            typeof value === "string" ? value : String(value),
                        };
                      }
                    }
                  );

                  answerData.matrixCells = {
                    create: matrixCells,
                  };
                }
              }

              return answerData;
            }),
          },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      console.log("🔥 Survey submitting:", response);

      // If reached max after insert → close
      if (
        max &&
        survey._count.responses + 1 >= max &&
        survey.status === SurveyStatus.PUBLISHED
      ) {
        const updatedSurvey = await tx.survey.update({
          where: { id: surveyId },
          data: { status: SurveyStatus.CLOSED },
          include: {
            user: true, // For sending notification to owner
            settings: true,
            _count: { select: { responses: true } },
          },
        });

        // The `update` operation throws if the survey is not found.
        // The surrounding `if` block ensures we only act on PUBLISHED surveys.
        await notifySurveyClosed(updatedSurvey, [
          `${process.env.SLACK_MAIN_CHANNEL_ID}`,
        ]);
        await notifySurveyClosedToOwner(updatedSurvey);
      }
    });

    // Trigger AI analysis if eligible
    const responseCount = survey._count.responses + 1;
    if (responseCount >= 10 && survey.status === SurveyStatus.CLOSED) {
      await enqueueAIAnalysisJob(surveyId);
    }

    // Trigger socket event with error handling
    try {
      const statistics = await ResponseService.getSurveyStatistics(
        surveyId,
        survey.userId!
      );
      const io = getIO();
      if (io) {
        // console.log('📡 Emitting statistics to room:', `survey:${surveyId}`);
        io.to(`survey:${surveyId}`).emit(
          "survey:statistics:update",
          statistics
        );
        // console.log('✅ Statistics emitted:', statistics);
      }
    } catch (error) {
      console.warn("❌ Socket.io not available for real-time updates:", error);
    }

    return { message: "Survey submitted successfully" };
  }

  static async getTemplateSurveys(userId: string): Promise<SurveyListResponse> {
    const templates = await prisma.survey.findMany({
      where: {
        isTemplate: true,
        OR: [{ userId: null }, { userId: userId }],
      },
      include: {
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      surveys: templates.map((template) => ({
        ...template,
        userId: template.userId || null,
      })),
      pagination: {
        total: templates.length,
        page: 1,
        pageSize: templates.length,
        totalPages: 1,
      },
    };
  }

  static async createTemplateByUser(
    data: CreateSurveyDto,
    userId: string
  ): Promise<SurveyWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Xoá media nếu có
      if (Array.isArray(data.deletedOptionMediaUrls)) {
        for (const url of data.deletedOptionMediaUrls) {
          try {
            await MediaService.deleteMedia(url);
          } catch (e) {
            console.error("Error deleting media:", url, e);
          }
        }
      }

      // Duplicate surveyMediaUrl nếu có
      let surveyMediaUrl = data.surveyMediaUrl ?? null;
      if (surveyMediaUrl) {
        surveyMediaUrl = await MediaService.duplicateMedia(surveyMediaUrl);
      }

      // Duplicate questionMediaUrl và optionMediaUrl nếu có
      const questions = await Promise.all(
        data.questions.map(async (q, idx) => {
          let questionMediaUrl = q.questionMediaUrl ?? null;
          if (questionMediaUrl) {
            questionMediaUrl = await MediaService.duplicateMedia(
              questionMediaUrl
            );
          }
          const options = q.options
            ? await Promise.all(
                q.options.map(async (o) => {
                  let optionMediaUrl = o.optionMediaUrl ?? null;
                  if (optionMediaUrl) {
                    optionMediaUrl = await MediaService.duplicateMedia(
                      optionMediaUrl
                    );
                  }
                  return {
                    optionText: o.optionText,
                    optionMediaUrl,
                    isOther: o.isOther ?? false,
                  };
                })
              )
            : undefined;

          const matrixRows = q.matrixRows?.map((row) => ({
            label: row.label,
            order: row.order,
          }));

          const matrixColumns = q.matrixColumns?.map((col) => ({
            label: col.label,
            order: col.order,
          }));

          return {
            questionText: q.questionText,
            questionMediaUrl,
            type: q.type,
            isRequired: q.isRequired ?? false,
            order: q.order ?? idx + 1,
            options: options ? { create: options } : undefined,
            matrixRows: matrixRows ? { create: matrixRows } : undefined,
            matrixColumns: matrixColumns
              ? { create: matrixColumns }
              : undefined,
          };
        })
      );

      const survey = await tx.survey.create({
        data: {
          title: data.title,
          description: data.description,
          surveyMediaUrl,
          status: SurveyStatus.PENDING,
          userId,
          isTemplate: true,
          questions: { create: questions },
          settings: {
            create: {
              requireEmail: data.settings?.requireEmail,
              responseLetter: data.settings?.responseLetter,
              openTime: data.settings?.openTime,
              closeTime: data.settings?.closeTime,
              maxResponse: data.settings?.maxResponse,
              autoCloseCondition: data.settings?.autoCloseCondition,
              allowMultipleResponses: data.settings?.allowMultipleResponses,
            },
          },
        },
        include: {
          questions: {
            include: {
              options: true,
              matrixRows: true,
              matrixColumns: true,
            },
          },
          settings: true,
        },
      });
      return { ...survey, userId: survey.userId! };
    });
  }

  // Slack integration methods
  static async getSlackChannels() {
    try {
      // Sử dụng slackApp có sẵn để lấy danh sách channels
      const result = await slackApp.client.conversations.list({
        types: "public_channel,private_channel",
      });

      return (
        result.channels?.map((channel: any) => ({
          id: channel.id,
          name: channel.name,
        })) || []
      );
    } catch (error) {
      console.error("Error getting Slack channels:", error);
      throw new InternalServerErrorException("Failed to get Slack channels");
    }
  }

  static async sendSlackNotification(
    surveyId: string,
    channels: string[],
    message: string
  ) {
    try {
      // Lấy thông tin survey
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: {
          user: true,
          questions: true,
        },
      });

      if (!survey) {
        throw new NotFoundException("Survey not found");
      }

      // Kiểm tra xem survey có câu hỏi matrix không
      const hasMatrixQuestions = survey.questions.some(
        (q: any) => q.type === "matrix_choice" || q.type === "matrix_input"
      );

      // Gửi block template đẹp, chỉ truyền custom message vào text
      const slackMessage = {
        text: message || "",
        blocks: createNewSurveyMessage({
          title: String(survey.title),
          customMessage: message,
          description: String(survey.description),
          publishedAt: survey.publishedAt
            ? new Date(survey.publishedAt)
            : undefined,
          closeAt: survey.closedAt ? new Date(survey.closedAt) : undefined,
          createdBy: survey.user?.email || "Unknown",
          surveyId: String(survey.id),
          hasMatrixQuestions,
        }).blocks,
      };

      // Gửi message đến các channels sử dụng slackApp
      const promises = channels.map((channelId) =>
        slackApp.client.chat.postMessage({
          channel: channelId,
          ...slackMessage,
        })
      );

      await Promise.all(promises);

      return { success: true };
    } catch (error) {
      console.error("Error sending Slack notification:", error);
      throw new InternalServerErrorException(
        "Failed to send Slack notification"
      );
    }
  }

  // Timing session methods
  static async startTimingSession(
    surveyId: string,
    data: StartSessionDto
  ): Promise<{ sessionId: string; startTime: Date; duration: number }> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, status: SurveyStatus.PUBLISHED },
      include: { settings: true },
    });

    if (!survey) {
      throw new NotFoundException("Survey not found or not published");
    }

    if (!survey.settings?.enableTiming) {
      throw new BadRequestException("Timing is not enabled for this survey");
    }

    if (!survey.settings?.requireEmail) {
      throw new BadRequestException("Email is required when timing is enabled");
    }

    if (!survey.settings?.timingDuration) {
      throw new BadRequestException("Timing duration is not set");
    }

    // Check if user already has an active session
    const existingSession = await prisma.surveySession.findFirst({
      where: {
        surveyId,
        userEmail: data.userEmail,
        isActive: true,
      },
    });

    if (existingSession) {
      // Check if session is still valid (not expired)
      const now = new Date();
      const sessionEndTime = new Date(
        existingSession.startTime.getTime() +
          (survey.settings.timingDuration + 3) * 60 * 1000 // +3 minutes buffer
      );

      if (now < sessionEndTime) {
        return {
          sessionId: existingSession.id,
          startTime: existingSession.startTime,
          duration: survey.settings.timingDuration,
        };
      } else {
        // Expire the old session
        await prisma.surveySession.update({
          where: { id: existingSession.id },
          data: { isActive: false, endTime: now },
        });
      }
    }

    // Create new session
    const session = await prisma.surveySession.create({
      data: {
        surveyId,
        userEmail: data.userEmail,
        startTime: new Date(),
        isActive: true,
      },
    });

    return {
      sessionId: session.id,
      startTime: session.startTime,
      duration: survey.settings.timingDuration,
    };
  }

  static async validateTimingSession(
    surveyId: string,
    data: ValidateSessionDto
  ): Promise<{ isValid: boolean; timeRemaining?: number; message?: string }> {
    const session = await prisma.surveySession.findUnique({
      where: { id: data.sessionId },
      include: { survey: { include: { settings: true } } },
    });

    if (!session) {
      return { isValid: false, message: "Session not found" };
    }

    if (!session.isActive) {
      return { isValid: false, message: "Session has expired" };
    }

    if (session.surveyId !== surveyId) {
      return { isValid: false, message: "Invalid session for this survey" };
    }

    const now = new Date();
    const sessionEndTime = new Date(
      session.startTime.getTime() +
        (session.survey.settings?.timingDuration || 0) * 60 * 1000
    );
    const bufferEndTime = new Date(sessionEndTime.getTime() + 3 * 60 * 1000); // +3 minutes buffer

    if (now > bufferEndTime) {
      // Session expired, mark as inactive
      await prisma.surveySession.update({
        where: { id: session.id },
        data: { isActive: false, endTime: now },
      });
      return { isValid: false, message: "Session has expired" };
    }

    const timeRemaining = Math.max(
      0,
      Math.floor((sessionEndTime.getTime() - now.getTime()) / 1000)
    );

    return {
      isValid: true,
      timeRemaining,
    };
  }

  static async expireTimingSession(sessionId: string): Promise<void> {
    await prisma.surveySession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endTime: new Date(),
      },
    });
  }
}
