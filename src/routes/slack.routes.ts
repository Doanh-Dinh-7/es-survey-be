import { Router } from 'express';
import { auth0Middleware } from '../middlewares/auth0.middleware';
import { SlackController } from '../controllers/slack.controller';

const router = Router();

// Slack integration routes
router.get('/channels', auth0Middleware, SlackController.getSlackChannels);
router.post('/notify-survey', auth0Middleware, SlackController.sendMessageToSlack);

export default router; 