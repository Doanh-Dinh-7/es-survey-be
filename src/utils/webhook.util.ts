// src/utils/webhook.util.ts

import axios from "axios";

interface SlackField {
  title: string;
  value: string;
  short?: boolean;
}

interface SlackAttachment {
  fallback: string;
  pretext?: string;
  color?: string;
  fields?: SlackField[];
}

export interface SlackMessage {
  text?: string; // Optional top-level message
  attachments?: SlackAttachment[];
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL as string;

export const sendSlackNotification = async (message: SlackMessage) => {
  try {
    const response = await axios.post(SLACK_WEBHOOK_URL, message, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 200) {
      throw new Error(`Slack API responded with status ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    throw error;
  }
};
