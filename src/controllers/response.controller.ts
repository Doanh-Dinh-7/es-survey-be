import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../services/response.service';
import { ApiResponseBuilder } from '../utils/api-response';

export class ResponseController {
    static async getSurveyResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
          const userId = req.user!.id;
          const surveyId = req.params.id;
          const survey = await ResponseService.getSurveyResponses(surveyId, userId);
          res.json(ApiResponseBuilder.success(survey, 'Survey responses retrieved successfully', 200));
        } catch (error) {
          next(error);
        }
    }

    static async getSurveyResponseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
                const userId = req.user!.id;
                const surveyId = req.params.id;
                const responseId = req.params.responseId;
                const survey = await ResponseService.getSurveyResponseDetail(surveyId, responseId, userId);
                res.json(ApiResponseBuilder.success(survey, 'Survey response detail retrieved successfully', 200));
            } catch (error) {
                next(error);
            }
    }

    static async getSurveyStatistic(req: Request, res: Response, next: NextFunction) : Promise<void> {
        try {
            const userId = req.user!.id;
            const surveyId = req.params.id;
            const statistic = await ResponseService.getSurveyStatistics(surveyId, userId);
            res.json(ApiResponseBuilder.success(statistic, "Statistic retrieved successfully",200));
        } catch (error) {
            next(error);
        }
    }

    static async deleteSurveyResponse(req: Request, res: Response, next: NextFunction) : Promise<void> {
        try {
            const userId = req.user!.id;
            const surveyId = req.params.id;
            const responseId = req.params.responseId;
            await ResponseService.deleteResponse(surveyId, responseId, userId);
            res.json(ApiResponseBuilder.success(null, "Response deleted successfully",200));
        } catch (error) {
            next(error);
        }
    }
}