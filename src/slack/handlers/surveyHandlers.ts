import { WebClient } from '@slack/web-api';
import { BlockAction, PlainTextOption } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { createNewSurveyMessage, createSurveyClosedMessage, createSurveyClosingSoonDM, createSurveyClosedDM } from '../templates/messageTemplates';
import { slackApp } from '../config';

const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const prisma = new PrismaClient();

// Utility function để xử lý dữ liệu survey một cách nhất quán
const normalizeSurveyData = (survey: any) => {
  return {
    ...survey,
    closeAt: survey.closeAt || survey.settings?.closeTime || survey.closedAt || null,
    publishedAt: survey.publishedAt || survey.settings?.openTime || new Date(),
    responseCount: survey._count?.responses || 0,
    maxResponse: survey.settings?.maxResponse || null
  };
};

export const notifyNewSurvey = async (survey: any, channelIds: string[], customMessage?: string) => {
  try {
    console.log('Sending new survey notification for survey:', survey.id);
    console.log('Channel IDs:', channelIds);

    // Lấy thông tin user từ survey.userId
    const user = await prisma.user.findUnique({
      where: { id: survey.userId }
    });

    // Xử lý dữ liệu một cách nhất quán
    const normalizedSurvey = normalizeSurveyData(survey);

    const message = createNewSurveyMessage({
      title: normalizedSurvey.title,
      customMessage: customMessage || "",
      description: normalizedSurvey.description,
      publishedAt: normalizedSurvey.publishedAt,
      closeAt: normalizedSurvey.closeAt,
      createdBy: user?.email || 'Unknown User',
      surveyId: normalizedSurvey.id
    });

    for (const channelId of channelIds) {
      if (!channelId) {
        console.warn('Skipping empty channel ID');
        continue;
      }
      await webClient.chat.postMessage({
        channel: channelId,
        text: customMessage || "",
        blocks: message.blocks
      });
    }
  } catch (error: any) {
    console.error('Error sending new survey notification:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
    throw error;
  }
};

export const notifySurveyClosed = async (survey: any, channelIds: string[]) => {
  try {
    console.log('Sending survey closed notification for survey:', survey.id);
    console.log('Channel IDs:', channelIds);

    console.log('Survey:', survey);

    // Lấy thông tin user từ survey.userId
    const user = await prisma.user.findUnique({
      where: { id: survey.userId }
    });
    console.log('User:', user);

    // Xử lý dữ liệu một cách nhất quán
    const normalizedSurvey = normalizeSurveyData(survey);

    const message = createSurveyClosedMessage({
      title: normalizedSurvey.title,
      description: normalizedSurvey.description,
      publishedAt: normalizedSurvey.publishedAt,
      closeAt: normalizedSurvey.closeAt,
      createdBy: user?.email || 'Unknown User',
      surveyId: normalizedSurvey.id,
      responseCount: normalizedSurvey.responseCount,
      maxResponse: normalizedSurvey.maxResponse
    });

    // console.log('Created message:', JSON.stringify(message, null, 2));

    for (const channelId of channelIds) {
      if (!channelId) {
        console.warn('Skipping empty channel ID');
        continue;
      }
      
      console.log(`Attempting to send message to channel ${channelId}`);
      
      const result = await webClient.chat.postMessage({
        channel: channelId,
        text: `Survey Closing Soon: ${normalizedSurvey.title}`,
        blocks: message.blocks
      });

      console.log('Message sent successfully');
    }
  } catch (error: any) {
    console.error('Error sending survey closed notification:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
    throw error;
  }
};

export const notifySurveyClosingSoon = async (survey: any) => {
  try {
    console.log('Sending survey closing soon notification for survey:', survey.id);
    console.log('Channel IDs:', process.env.SLACK_MAIN_CHANNEL_ID);

    console.log('Survey:', survey);

    // Lấy thông tin user từ survey.userId
    const user = await prisma.user.findUnique({
      where: { id: survey.userId }
    });
    console.log('User:', user);

    // Xử lý dữ liệu một cách nhất quán
    const normalizedSurvey = normalizeSurveyData(survey);

    const message = createSurveyClosingSoonDM({
      title: normalizedSurvey.title,
      description: normalizedSurvey.description,
      publishedAt: normalizedSurvey.publishedAt,
      closeAt: normalizedSurvey.closeAt,
      createdBy: user?.email || 'Unknown User',
      surveyId: normalizedSurvey.id,
      responseCount: normalizedSurvey.responseCount,
      maxResponse: normalizedSurvey.maxResponse
    });

    // console.log('Created message:', JSON.stringify(message, null, 2));

    const result = await webClient.chat.postMessage({
      channel: process.env.SLACK_MAIN_CHANNEL_ID || '',
      text: `Survey Closing Soon: ${normalizedSurvey.title}`,
      blocks: message.blocks
    });

  } catch (error: any) {
    console.error('Error sending survey closing notification:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
    throw error;
  }
};

export const notifySurveyClosedToOwner = async (survey: any) => {
  try {
    console.log('Sending survey closed DM to owner for survey:', survey.id);

    // Lấy thông tin user từ survey.userId
    const user = await prisma.user.findUnique({
      where: { id: survey.userId }
    });

    if (!user?.email) {
      console.warn('Cannot send DM: User email not found');
      return;
    }
    
    console.log('Survey:', survey);

    // Tìm Slack user ID từ email
    const slackUser = await webClient.users.lookupByEmail({
      email: user.email
    });

    if (!slackUser.ok || !slackUser.user?.id) {
      console.warn('Cannot send DM: Slack user not found');
      return;
    }

    // Xử lý dữ liệu một cách nhất quán
    const normalizedSurvey = normalizeSurveyData(survey);

    const message = createSurveyClosedDM({
      title: normalizedSurvey.title,
      description: normalizedSurvey.description,
      publishedAt: normalizedSurvey.publishedAt,
      closeAt: normalizedSurvey.closeAt,
      createdBy: user.email,
      surveyId: normalizedSurvey.id,
      responseCount: normalizedSurvey.responseCount,
      maxResponse: normalizedSurvey.maxResponse
    });

    console.log('Sending DM to user:', slackUser.user.id);
    
    const result = await webClient.chat.postMessage({
      channel: slackUser.user.id,
      text: `Survey Closed: ${normalizedSurvey.title}`,
      blocks: message.blocks
    });

    console.log('DM sent successfully:', result);
  } catch (error: any) {
    console.error('Error sending survey closed DM:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
  }
};

// Handler cho việc chọn channel
export const setupChannelSelection = () => {
  slackApp.action('select_channel', async ({ ack, body, client }: { ack: any; body: any; client: any }) => {
    await ack();
    
    try {
      // Lấy danh sách channels
      const result = await client.conversations.list({
        types: 'public_channel,private_channel'
      });

      const channels: PlainTextOption[] = result.channels?.map((channel: any) => ({
        text: {
          type: 'plain_text' as const,
          text: channel.name || ''
        },
        value: channel.id || ''
      })) || [];

      // Hiển thị modal để chọn channel
      await client.views.open({
        trigger_id: (body as BlockAction).trigger_id,
        view: {
          type: 'modal',
          callback_id: 'channel_selection_modal',
          title: {
            type: 'plain_text',
            text: 'Select Channels'
          },
          submit: {
            type: 'plain_text',
            text: 'Submit'
          },
          blocks: [
            {
              type: 'input',
              block_id: 'channels_block',
              element: {
                type: 'multi_static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select channels'
                },
                options: channels
              },
              label: {
                type: 'plain_text',
                text: 'Channels to share survey'
              }
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error setting up channel selection:', error);
    }
  });
};
