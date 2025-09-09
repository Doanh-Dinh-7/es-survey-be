import { Request, Response, NextFunction } from 'express';
import { SurveyService } from '../services/survey.service';
import { ApiResponseBuilder } from '../utils/api-response';
import { enqueueAIAnalysisJob } from '../utils/ai.util';

export class SurveyController {
  static async createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const survey = await SurveyService.createSurvey(req.body, userId);
      res.json(ApiResponseBuilder.success(survey, 'Survey created successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  static async getSurveyDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      const survey = await SurveyService.getSurveyDetail(surveyId, userId);
      res.json(ApiResponseBuilder.success(survey, 'Survey detail retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async getMySurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 9;
      const surveys = await SurveyService.getMySurveysByUserId(userId, page, pageSize);
      res.json(ApiResponseBuilder.success(surveys, 'My surveys retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      const survey = await SurveyService.updateSurvey(surveyId, req.body, userId);
      res.json(ApiResponseBuilder.success(survey, 'Survey updated successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      await SurveyService.deleteSurvey(surveyId, userId);
      res.json(ApiResponseBuilder.success(null, 'Survey deleted successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async toggleSurveyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      const { channels, message } = req.body;
      const survey = await SurveyService.toggleSurveyStatus(surveyId, userId, channels, message);
      res.json(ApiResponseBuilder.success(survey, 'Survey status updated successfully', 200));
    } catch (error) {
      next(error);
    }
  }
  
  static async getPublishedSurveyDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id;
      const userId = req.user?.id;
      const survey = await SurveyService.getPublishedSurveyDetail(surveyId, userId);
      console.log(userId ? "Participate in Logged in account": "Participate in Anonymous");
      res.json(ApiResponseBuilder.success(survey, 'Published survey detail retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async cloneSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      const survey = await SurveyService.cloneSurvey(surveyId, userId);
      res.json(ApiResponseBuilder.success(survey, 'Survey cloned successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async updateSurveySetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveyId = req.params.id;
      const survey = await SurveyService.updateSurveySetting(surveyId, req.body, userId);
      res.json(ApiResponseBuilder.success(survey, 'Survey setting updated successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async submitSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id;
      const userId = req.user?.id;
      const data = {
        ...req.body,
        ipAddress: req.clientInfo?.ipAddress,
        userAgent: req.clientInfo?.userAgent
      };

      const result = await SurveyService.submitSurvey(surveyId, data, userId, req.auth?.payload.sub);
      res.json(ApiResponseBuilder.success(result, 'Survey submitted successfully', 201));
    } catch (error) {
      next(error);
    }
  }

  static async triggerAIAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id;
      const analysis = await enqueueAIAnalysisJob(surveyId);
      res.json(ApiResponseBuilder.success(analysis, 'AI analysis triggered', 200));
    } catch (error) {
      next(error);
    }
  }

  static async getTemplateSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const surveys = await SurveyService.getTemplateSurveys(userId);
      res.json(ApiResponseBuilder.success(surveys, 'Template surveys retrieved successfully', 200));
    } catch (error) {
      next(error);
    }
  }

  static async createTemplateByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const survey = await SurveyService.createTemplateByUser(req.body, userId);
      res.json(ApiResponseBuilder.success(survey, 'Template created successfully', 201));
    } catch (error) {
      next(error);
    }
  }
}
