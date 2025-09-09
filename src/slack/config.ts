import { App } from '@slack/bolt';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SLACK_APP_TOKEN || !process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
  throw new Error('Missing required Slack environment variables');
}

export const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

export const initializeSlack = async () => {
  await slackApp.start();
  console.log('⚡️ Slack app is running with Socket Mode!');
};
