import { auth0Middleware } from '../middlewares/auth0.middleware';
import { SurveyService } from '../services/survey.service';
import { ApiResponseBuilder } from '../utils/api-response';
import { Request, Response, NextFunction } from 'express';

export class SlackController {
    static async getSlackChannels (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const channels = await SurveyService.getSlackChannels();
        res.json(ApiResponseBuilder.success(channels, 'Retrieve channel successfullly', 201));
    } catch (error) {
        next(error);
    }
    };
      
    static async sendMessageToSlack (req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { surveyId, channels, message } = req.body;
            const status = await SurveyService.sendSlackNotification(surveyId, channels, message);
            res.json(ApiResponseBuilder.success(status,"Send message to Slack successfully!",201));
        } catch (error) {
            next(error);
        }
    }
};