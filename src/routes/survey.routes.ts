import { Router } from 'express';
import { SurveyController } from '../controllers/survey.controller';
import { validate } from '../middlewares/validation.middleware';
import { createSurveySchema, submitSurveySchema, updateSurveySchema, updateSurveySettingSchema } from '../dtos/survey.dto';
import { ResponseController } from '../controllers/response.controller';
import { auth0Middleware, userMapperMiddleware } from '../middlewares/auth0.middleware';

const router = Router();

{/* routes for survey creator */}
router.post('/', auth0Middleware, userMapperMiddleware, validate(createSurveySchema), SurveyController.createSurvey);
router.get('/my', auth0Middleware, userMapperMiddleware, SurveyController.getMySurveys);
router.get('/templates', auth0Middleware, userMapperMiddleware, SurveyController.getTemplateSurveys);
router.post('/templates', auth0Middleware, userMapperMiddleware, SurveyController.createTemplateByUser);
router.get('/:id', auth0Middleware, userMapperMiddleware, SurveyController.getSurveyDetail);
router.patch('/:id', auth0Middleware, userMapperMiddleware, validate(updateSurveySchema), SurveyController.updateSurvey);
router.delete('/:id', auth0Middleware, userMapperMiddleware, SurveyController.deleteSurvey);
router.patch('/:id/status', auth0Middleware, userMapperMiddleware, SurveyController.toggleSurveyStatus);
router.post('/:id/clone', auth0Middleware, userMapperMiddleware, SurveyController.cloneSurvey);
router.put('/:id/settings', auth0Middleware, userMapperMiddleware, validate(updateSurveySettingSchema), SurveyController.updateSurveySetting);
router.post('/:id/analysis', auth0Middleware, userMapperMiddleware, SurveyController.triggerAIAnalysis);
{/* routes for respondent */}
router.get('/:id/public', SurveyController.getPublishedSurveyDetail);
router.post('/:id/responses', validate(submitSurveySchema), SurveyController.submitSurvey);

{/* routes for result */}
router.get('/:id/responses', auth0Middleware, userMapperMiddleware, ResponseController.getSurveyResponses);
router.get('/:id/responses/:responseId', auth0Middleware, userMapperMiddleware, ResponseController.getSurveyResponseDetail);
router.delete('/:id/responses/:responseId', auth0Middleware, userMapperMiddleware, ResponseController.deleteSurveyResponse);
router.get('/:id/statistics', auth0Middleware, userMapperMiddleware, ResponseController.getSurveyStatistic);

export default router; 