// Survey Modal Handlers for Slack Integration
import { slackApp } from "../config";
import { WebClient } from "@slack/web-api";
import { PrismaClient, QuestionType } from "@prisma/client";
import axios from "axios";
import { title } from "process";

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

// Sử dụng singleton pattern cho PrismaClient để tối ưu connection pool
let prisma: PrismaClient;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Tối ưu connection pool
      log: ["error", "warn"],
    });
  }
  return prisma;
}

const MAX_QUESTIONS_PER_VIEW = 15;

// Cache cho survey data để tránh query lại
const surveyCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

function getFullMediaUrl(path: string) {
  if (!path) return null;
  return path.startsWith("http")
    ? path
    : `${process.env.API_BASE_URL || "http://localhost:3000"}${path}`;
}

// Tối ưu: Cache survey data
async function getCachedSurvey(surveyId: string) {
  const now = Date.now();
  const cached = surveyCache.get(surveyId);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const prisma = getPrismaClient();
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
    },
  });

  if (survey) {
    surveyCache.set(surveyId, { data: survey, timestamp: now });
  }

  return survey;
}

function buildQuestionBlocks(question: any, index: number) {
  const blocks: any[] = [];
  const questionText = `*${index + 1}. ${question.questionText}*${
    question.isRequired ? " *" : ""
  }`;

  // Section block cho question text và media
  const section: any = {
    type: "section",
    text: { type: "mrkdwn", text: questionText },
  };
  const questionImageUrl = getFullMediaUrl(question.questionMediaUrl);
  // const questionImageUrl = "https://dummyjson.com/image/400x200/008080/ffffff?text=Hello+Peter";

  if (questionImageUrl) {
    section.accessory = {
      type: "image",
      image_url: questionImageUrl,
      alt_text: question.questionText,
    };
  }
  blocks.push(section);

  const actionId = `answer_${question.id}`;

  // Input block cho câu trả lời
  switch (question.type) {
    case QuestionType.short_text:
    case QuestionType.long_text:
      blocks.push({
        type: "input",
        block_id: `question_${question.id}`,
        label: { type: "plain_text", text: "Your answer", emoji: true },
        optional: !question.isRequired,
        element: {
          type: "plain_text_input",
          multiline: question.type === QuestionType.long_text,
          action_id: actionId,
          placeholder: {
            type: "plain_text",
            text:
              question.type === QuestionType.long_text
                ? "Enter your detailed answer"
                : "Enter your answer",
          },
        },
      });
      break;

    case QuestionType.multiple_choice:
    case QuestionType.checkbox:
      // Tối ưu: Chỉ thêm media blocks nếu thực sự cần thiết
      const optionsWithMedia = question.options.filter(
        (opt: any) => opt.optionMediaUrl
      );

      // Thêm block chính chứa tất cả options
      blocks.push({
        type: "section",
        block_id: `question_${question.id}`,
        text: { type: "mrkdwn", text: "Select your answer:" },
        accessory: {
          type:
            question.type === QuestionType.multiple_choice
              ? "radio_buttons"
              : "checkboxes",
          action_id: actionId,
          options: question.options.map((opt: any) => ({
            text: { type: "plain_text", text: opt.optionText, emoji: true },
            value: opt.id,
          })),
        },
      });

      // Chỉ thêm media blocks nếu có media
      if (optionsWithMedia.length > 0) {
        for (const opt of optionsWithMedia) {
          blocks.push({
            type: "image",
            image_url: getFullMediaUrl(opt.optionMediaUrl),
            // image_url:
            //  "https://www.houseofblanks.com/cdn/shop/files/HeavyweightTshirt_White_01_2.jpg?v=1726516822&width=1946",
            alt_text: opt.optionText,
          });
          blocks.push({
            type: "context",
            elements: [
              {
                type: "plain_text",
                text: opt.optionText,
                emoji: true,
              },
            ],
          });
        }
      }
      break;
  }

  return blocks;
}

export const openSurveyStepModal = async (
  surveyId: string,
  triggerId: string,
  step = 0,
  channelId?: string
) => {
  const survey = await getCachedSurvey(surveyId);

  if (!survey || survey.status !== "PUBLISHED") {
    throw new Error("Survey is not available or has been closed.");
  }

  // Giảm logging trong production
  if (process.env.NODE_ENV === "development") {
    console.log("Survey loaded from cache:", survey.title);
  }

  const start = step * MAX_QUESTIONS_PER_VIEW;
  const stepQuestions = survey.questions.slice(
    start,
    start + MAX_QUESTIONS_PER_VIEW
  );
  const isLastStep = start + MAX_QUESTIONS_PER_VIEW >= survey.questions.length;

  const blocks: any[] = [];

  blocks.unshift({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: ':information_source: *Please answer all questions marked with an ellipsis * (required). If you selected "Other", enter your answer in the box below.*',
      },
    ],
  });

  if (step === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${survey.title}*\n${survey.description || ""}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  for (const [i, q] of stepQuestions.entries()) {
    blocks.push(...buildQuestionBlocks(q, start + i));
    if (i < stepQuestions.length - 1) {
      blocks.push({ type: "divider" });
    }
  }

  const view = {
    type: "modal" as const,
    callback_id: isLastStep ? "survey_submission" : `step_${step + 1}`,
    private_metadata: isLastStep
      ? JSON.stringify({ surveyId, channelId })
      : JSON.stringify({ surveyId, step: step + 1, channelId }),
    title: { type: "plain_text" as const, text: "Survey", emoji: true },
    submit: {
      type: "plain_text" as const,
      text: isLastStep ? "Submit" : "Next",
      emoji: true,
    },
    close: { type: "plain_text" as const, text: "Cancel", emoji: true },
    blocks,
  };

  try {
    await web.views.open({ trigger_id: triggerId, view });
  } catch (error: any) {
    console.error("Error opening modal:", error);
    throw error;
  }
};

// Setup Slack actions for handling dynamic form updates
export const setupSlackActions = (slackApp: any) => {
  console.log("Setting up Slack actions for dynamic form updates...");

  slackApp.action(/^answer_.*/, async ({ ack, body, client }: any) => {
    await ack();

    // Giảm logging trong production
    if (process.env.NODE_ENV === "development") {
      console.log("=== SLACK ACTION TRIGGERED ===");
    }

    try {
      const view = body.view;
      if (!view) {
        console.error("No view found in action body");
        return;
      }

      let surveyId = view.private_metadata;
      if (surveyId.startsWith("{")) {
        surveyId = JSON.parse(surveyId).surveyId;
      }

      // Sử dụng cached survey thay vì query lại
      const survey = await getCachedSurvey(surveyId);

      if (!survey) {
        console.error("Survey not found for action handler");
        return;
      }

      const stateValues = view.state.values;
      const questionIdsThatNeedCustomInput = new Set<string>();

      for (const question of survey.questions) {
        const actionId = `answer_${question.id}`;
        let answerData: any = null;

        for (const block of Object.values(stateValues)) {
          if ((block as any)[actionId]) {
            answerData = (block as any)[actionId];
            break;
          }
        }

        if (!answerData) continue;

        let isOtherSelected = false;
        if (
          question.type === QuestionType.multiple_choice &&
          answerData.selected_option
        ) {
          isOtherSelected = !!question.options.find(
            (opt: any) => opt.id === answerData.selected_option.value
          )?.isOther;
        } else if (
          question.type === QuestionType.checkbox &&
          answerData.selected_options
        ) {
          const selectedIds = answerData.selected_options.map(
            (opt: any) => opt.value
          );
          isOtherSelected = question.options.some(
            (opt: any) => opt.isOther && selectedIds.includes(opt.id)
          );
        }

        if (isOtherSelected) {
          questionIdsThatNeedCustomInput.add(question.id);
        }
      }

      console.log(
        "Questions that need custom input:",
        Array.from(questionIdsThatNeedCustomInput)
      );

      const originalBlocks = view.blocks.filter(
        (b: any) => !b.block_id?.startsWith("custom_")
      );
      const newBlocks: any[] = [];

      for (const block of originalBlocks) {
        newBlocks.push(block);
        const actionId = block.accessory?.action_id;
        if (block.type === "section" && actionId?.startsWith("answer_")) {
          const questionId = actionId.replace("answer_", "");
          if (questionIdsThatNeedCustomInput.has(questionId)) {
            newBlocks.push({
              type: "input",
              block_id: `custom_${questionId}`,
              optional: true,
              label: {
                type: "plain_text",
                text: "Please specify",
                emoji: true,
              },
              element: {
                type: "plain_text_input",
                action_id: `custom_text_${questionId}`,
                placeholder: {
                  type: "plain_text",
                  text: "Enter your custom answer here...",
                },
              },
            });
          }
        }
      }

      const shouldUpdate =
        JSON.stringify(newBlocks) !== JSON.stringify(view.blocks);

      if (shouldUpdate) {
        if (process.env.NODE_ENV === "development") {
          console.log("Updating modal view with new custom blocks.");
        }
        await client.views.update({
          view_id: view.id,
          hash: view.hash,
          view: {
            type: "modal",
            callback_id: view.callback_id,
            private_metadata: view.private_metadata,
            title: view.title,
            submit: view.submit,
            close: view.close,
            blocks: newBlocks,
          },
        });
        if (process.env.NODE_ENV === "development") {
          console.log("Modal view updated successfully.");
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("No view update needed.");
        }
      }
    } catch (error) {
      console.error("Error updating modal view:", error);
    }
  });
};

// Setup survey modal handlers
export const setupSurveyModalHandlers = () => {
  slackApp.action("open_survey", async ({ ack, body, client }: any) => {
    await ack();
    const triggerId = (body as any).trigger_id;
    const surveyId = (body as any).actions?.[0]?.value;
    const userId = body.user.id;
    const channelId = body.channel.id;

    if (!triggerId || !surveyId) {
      console.error("Missing triggerId or surveyId");
      return;
    }

    try {
      await openSurveyStepModal(surveyId, triggerId, 0, channelId);
    } catch (error: any) {
      console.error(
        `Failed to open survey modal for user ${userId} in channel ${channelId}. SurveyId: ${surveyId}. Error: ${error.message}`
      );
      try {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "This survey could not be opened. It might have been closed or is no longer available.",
        });
      } catch (ephemeralError: any) {
        console.error(
          `Failed to send ephemeral error message: ${ephemeralError.message}`
        );
      }
    }
  });

  // Handle step navigation
  slackApp.view(/^step_\d+$/, async ({ ack, body }: any) => {
    await ack();
    const { surveyId, step, channelId } = JSON.parse(
      body.view.private_metadata
    );
    const triggerId = body.trigger_id;

    await openSurveyStepModal(surveyId, triggerId, step, channelId);
  });

  // Handle final submission
  slackApp.view("survey_submission", async ({ ack, body }) => {
    console.log("=== SURVEY SUBMISSION STARTED ===");
    // console.log('Body:', JSON.stringify(body, null, 2));

    const answers = body.view.state.values;
    const errors: any = {};
    const { surveyId, channelId } = JSON.parse(body.view.private_metadata);

    console.log("Survey ID:", surveyId);
    console.log("Channel ID:", channelId);
    console.log("Raw answers:", JSON.stringify(answers, null, 2));

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { questions: { include: { options: true } } },
    });

    if (!survey) {
      console.error("Survey not found:", surveyId);
      return await ack({
        response_action: "errors",
        errors: { general: "Survey not found" },
      });
    }

    console.log(
      "Questions:",
      survey.questions.map((q) => ({
        id: q.id,
        type: q.type,
        isRequired: q.isRequired,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.optionText,
          isOther: o.isOther,
        })),
      }))
    );

    // Validate required fields
    for (const question of survey.questions) {
      const questionId = question.id;
      const blockId = `question_${questionId}`;
      const blockData = answers[blockId];

      console.log(`Validating question ${questionId}:`, {
        type: question.type,
        isRequired: question.isRequired,
        blockData,
      });

      if (!question.isRequired) {
        continue; // Skip validation for non-required questions
      }

      let hasAnswer = false;

      if (blockData) {
        const answerData = blockData[`answer_${questionId}`];
        console.log(`Answer data for question ${questionId}:`, answerData);

        if (answerData) {
          switch (question.type) {
            case QuestionType.short_text:
            case QuestionType.long_text:
              hasAnswer = !!(
                answerData.value && answerData.value.trim() !== ""
              );
              break;

            case QuestionType.multiple_choice:
              hasAnswer = !!(
                answerData.selected_option && answerData.selected_option.value
              );
              break;

            case QuestionType.checkbox:
              hasAnswer = !!(
                Array.isArray(answerData.selected_options) &&
                answerData.selected_options.length > 0
              );
              break;
          }
        }
      }

      if (!hasAnswer) {
        errors[blockId] =
          "Câu hỏi này là bắt buộc. Vui lòng trả lời trước khi submit.";
        console.log(`Missing required answer for question ${questionId}`);
      }
    }

    console.log("Validation errors:", errors);

    if (Object.keys(errors).length > 0) {
      console.log("Returning validation errors to modal");
      console.log("Error block IDs:", Object.keys(errors));

      // Tạo error blocks để hiển thị trong modal
      const errorBlocks = Object.entries(errors).map(
        ([blockId, errorMessage]) => ({
          type: "context",
          block_id: `error_${blockId}`,
          elements: [
            {
              type: "mrkdwn",
              text: `:warning: ${errorMessage}`,
            },
          ],
        })
      );

      // Cập nhật modal với error blocks
      try {
        const updatedBlocks = [...body.view.blocks];

        // Thêm error blocks sau mỗi question block có lỗi
        for (const [blockId, errorMessage] of Object.entries(errors)) {
          const questionId = blockId.replace("question_", "");
          const questionIndex = updatedBlocks.findIndex(
            (block) => block.block_id === blockId
          );

          if (questionIndex !== -1) {
            // Thêm error block ngay sau question block
            updatedBlocks.splice(questionIndex + 1, 0, {
              type: "context",
              block_id: `error_${blockId}`,
              elements: [
                {
                  type: "mrkdwn",
                  text: `:warning: ${errorMessage}`,
                },
              ],
            });
          }
        }

        await web.views.update({
          view_id: body.view.id,
          hash: body.view.hash,
          view: {
            type: "modal",
            callback_id: "survey_submission",
            private_metadata: body.view.private_metadata,
            title: body.view.title as any,
            submit: body.view.submit as any,
            close: body.view.close as any,
            blocks: updatedBlocks,
          },
        });
      } catch (updateError) {
        console.error("Error updating modal with errors:", updateError);
      }

      return await ack({
        response_action: "errors",
        errors,
      });
    }

    // Nếu không lỗi thì tiếp tục xử lý submit
    console.log("No validation errors, proceeding with submission");
    await ack();

    try {
      const userId = body.user.id;
      console.log("Processing survey submission:", { surveyId, userId });
      console.log("Raw answers from Slack:", JSON.stringify(answers, null, 2));

      // Lấy thông tin user từ Slack
      const userInfo = await web.users.info({ user: userId });
      const userEmail = userInfo.user?.profile?.email;

      if (!userEmail) {
        throw new Error("Could not get user email from Slack");
      }

      // Chuẩn bị data để gửi đến API
      const surveyAnswers = [];

      console.log("Processing answers for submission...");
      for (const [blockId, blockData] of Object.entries(answers)) {
        console.log(`Processing block: ${blockId}`, blockData);

        if (blockId.startsWith("custom_")) {
          console.log(`Skipping custom block: ${blockId}`);
          continue;
        }

        // Xử lý input blocks (text questions)
        if (blockId.startsWith("question_")) {
          const questionId = blockId.replace("question_", "");
          const question = survey.questions.find((q) => q.id === questionId);

          if (!question) {
            console.log(`Question not found for blockId: ${blockId}`);
            continue;
          }

          const answerData = (blockData as any)[`answer_${questionId}`];
          if (!answerData) {
            console.log(`No answer data for question: ${questionId}`);
            continue;
          }

          console.log(
            `Processing question ${questionId} (${question.type}):`,
            answerData
          );

          let answerValue = "";
          let customText: string | null = null;

          switch (question.type) {
            case QuestionType.short_text:
            case QuestionType.long_text:
              answerValue = answerData.value || "";
              console.log(`Text answer: ${answerValue}`);
              break;
          }

          if (answerValue) {
            const answerObj: any = {
              questionId,
              answer: answerValue,
            };
            if (
              customText &&
              typeof customText === "string" &&
              (customText as string).trim() !== ""
            ) {
              answerObj.customText = customText;
            }
            surveyAnswers.push(answerObj);
            console.log(`Added answer:`, answerObj);
          }
        }
      }

      // Xử lý riêng cho radio buttons và checkboxes (section blocks)
      for (const question of survey.questions) {
        if (
          question.type === QuestionType.multiple_choice ||
          question.type === QuestionType.checkbox
        ) {
          const actionId = `answer_${question.id}`;

          // Tìm answer data từ tất cả blocks
          let answerData = null;
          for (const [blockId, blockData] of Object.entries(answers)) {
            if (
              blockData &&
              typeof blockData === "object" &&
              actionId in blockData
            ) {
              answerData = (blockData as any)[actionId];
              console.log(
                `Found answer data for ${question.type} question ${question.id} in block ${blockId}:`,
                answerData
              );
              break;
            }
          }

          if (!answerData) {
            console.log(
              `No answer data for ${question.type} question: ${question.id}`
            );
            continue;
          }

          console.log(
            `Processing ${question.type} question ${question.id}:`,
            answerData
          );

          let answerValue = "";
          let customText: string | null = null;

          switch (question.type) {
            case QuestionType.multiple_choice:
              if (answerData.selected_option) {
                answerValue = answerData.selected_option.value;
                const selectedOption = question.options.find(
                  (opt) => opt.id === answerValue
                );
                console.log(`Selected option:`, selectedOption);
                if (selectedOption?.isOther) {
                  console.log(`Option is "Other", looking for custom text`);
                  const customBlockData = answers[`custom_${question.id}`];
                  console.log(`Custom block data:`, customBlockData);
                  if (customBlockData) {
                    customText =
                      customBlockData[`custom_text_${question.id}`]?.value ||
                      null;
                    console.log(`Custom text found: ${customText}`);
                  }
                }
              }
              break;

            case QuestionType.checkbox:
              if (Array.isArray(answerData.selected_options)) {
                answerValue = answerData.selected_options
                  .map((opt: any) => opt.value)
                  .join(",");
                const selectedOptionIds = answerData.selected_options.map(
                  (opt: any) => opt.value
                );
                const hasOtherOption = question.options.some(
                  (opt) => opt.isOther && selectedOptionIds.includes(opt.id)
                );
                console.log(
                  `Checkbox options: ${answerValue}, has other: ${hasOtherOption}`
                );

                if (hasOtherOption) {
                  console.log(`Has "Other" option, looking for custom text`);
                  const customBlockData = answers[`custom_${question.id}`];
                  console.log(`Custom block data:`, customBlockData);
                  if (customBlockData) {
                    customText =
                      customBlockData[`custom_text_${question.id}`]?.value ||
                      null;
                    console.log(`Custom text found: ${customText}`);
                  }
                }
              }
              break;
          }

          if (
            answerValue ||
            (customText &&
              typeof customText === "string" &&
              (customText as string).trim() !== "")
          ) {
            const answerObj: any = {
              questionId: question.id,
              answer: answerValue,
            };
            if (
              customText &&
              typeof customText === "string" &&
              (customText as string).trim() !== ""
            ) {
              answerObj.customText = customText;
            }
            surveyAnswers.push(answerObj);
            console.log(`Added answer:`, answerObj);
          }
        }
      }

      const surveyData = {
        answers: surveyAnswers,
        userEmail,
      };

      console.log("Sending survey data:", JSON.stringify(surveyData, null, 2));

      // Gửi request đến API
      const response = await axios.post(
        `${
          process.env.API_BASE_URL || "http://localhost:3000"
        }/api/v1/surveys/${surveyId}/responses`,
        surveyData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("API response:", response.data);

      // Gửi thông báo thành công
      await web.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "✅ Survey submitted successfully! Thank you for your response.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *Survey submitted successfully!*\nThank you for your response.",
            },
          },
        ],
      });

      console.log("=== SURVEY SUBMISSION COMPLETED SUCCESSFULLY ===");
    } catch (error: any) {
      console.error("=== SURVEY SUBMISSION ERROR ===");
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });
      console.error("Full error:", error);

      // Gửi thông báo lỗi
      await web.chat.postEphemeral({
        channel: channelId,
        user: body.user.id,
        text: "❌ Failed to submit survey. Please try again.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `❌ *Failed to submit survey*\n${
                error.response?.data?.message ||
                "Please try again or contact support."
              }`,
            },
          },
        ],
      });
    }
  });
};
