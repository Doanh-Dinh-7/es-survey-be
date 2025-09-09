import { PrismaClient, SurveyStatus, AutoCloseCondition } from '@prisma/client';
import * as cron from 'node-cron';
import { enqueueAIAnalysisJob } from '../utils/ai.util';
import { notifySurveyClosed, notifySurveyClosingSoon, notifySurveyClosedToOwner, notifyNewSurvey } from '../slack/handlers/surveyHandlers';

const prisma = new PrismaClient();

export class CronService {
  static async checkAndUpdateSurveyStatus() {
    try {
      const now = new Date();
      // Get all surveys that need status updates (pending or published)
      const surveys = await prisma.survey.findMany({
        where: {
          status: {
            in: [SurveyStatus.PENDING, SurveyStatus.PUBLISHED]
          }
        },
        include: {
          settings: true,
          user: true,
          _count: {
            select: { responses: true }
          }
        }
      });

      for (const survey of surveys) {
        const actions = [];

        // Handle Opening Time
        if (survey.status === SurveyStatus.PENDING && 
            survey.settings?.openTime && 
            new Date(survey.settings.openTime) <= now) {
          await prisma.survey.update({
            where: { id: survey.id },
            data: {
              status: SurveyStatus.PUBLISHED,
              publishedAt: now
            }
          });
          actions.push('opened (reached opening time)');
          await notifyNewSurvey(survey, [`${process.env.SLACK_MAIN_CHANNEL_ID}`]);
          continue; // Skip closing checks for newly opened surveys
        }

        // Handle Closing Conditions for Published Surveys
        if (survey.status === SurveyStatus.PUBLISHED) {
          let shouldClose = false;
          const closeReasons = [];

          // Check if survey is closing in 5 minutes
          if (survey.settings?.closeTime) {
            const closeTime = new Date(survey.settings.closeTime).getTime();
            const nowTime = now.getTime();
            const diffInMs = closeTime - nowTime;
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
          
            if (diffInMinutes >= 5 && diffInMinutes < 6) {
              await notifySurveyClosingSoon(survey);
              console.log(`🔔 Survey ${survey.id} will close in 5 minutes.`);
            }
          }

          switch (survey.settings?.autoCloseCondition) {
            case AutoCloseCondition.by_time:
              if (survey.settings.closeTime && new Date(survey.settings.closeTime) <= now) {
                shouldClose = true;
                closeReasons.push('reached closing time');
              }
              break;

            case AutoCloseCondition.by_response:
              if (survey.settings?.maxResponse && survey._count.responses >= survey.settings.maxResponse) {
                shouldClose = true;
                closeReasons.push('reached maximum responses');
              }
              break;

            case AutoCloseCondition.manual:
              // In manual mode, check both conditions
              if (survey.settings?.closeTime && new Date(survey.settings.closeTime) <= now) {
                shouldClose = true;
                closeReasons.push('reached closing time (manual mode)');
              }
              if (survey.settings?.maxResponse && survey._count.responses >= survey.settings.maxResponse) {
                shouldClose = true;
                closeReasons.push('reached maximum responses (manual mode)');
              }
              break;
          }

          if (shouldClose) {
            await prisma.survey.update({
              where: { id: survey.id },
              data: {
                status: SurveyStatus.CLOSED,
                closedAt: now
              }
            });
            // Send closing notification to channel
            await notifySurveyClosed(survey, [`${process.env.SLACK_MAIN_CHANNEL_ID}`]);
            // Send closed notification to owner
            await notifySurveyClosedToOwner(survey);
            actions.push(`closed (${closeReasons.join(' and ')})`);
          }
        }

        // Log actions if any were taken
        if (actions.length > 0) {
          console.log(`Survey ${survey.id} status updated: ${actions.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Error in checkAndUpdateSurveyStatus:', error);
    }
  }

  static async checkAndUpdateAIAnalysis() {
    console.log("Runing update AI Analyze in background");
    try {
      const surveys = await prisma.survey.findMany({
        where: {
          aiAnalysis: null,
          status: SurveyStatus.CLOSED
        },
        include: {
          responses: true
        }
      });

      if (surveys.length === 0) {
        return;
      }

      if (surveys[0].responses.length < 10){
        return;
      }

      const surveysToProcess = surveys.slice(0, 10);

      for (const survey of surveysToProcess) {
        await enqueueAIAnalysisJob(survey.id);
      }
    } catch (error) {
      console.error('Error in checkAndUpdateAIAnalysis:', error);
    }
  }

  static initCronJobs() {
    // Run every minute
    cron.schedule('* * * * *', () => {
      this.checkAndUpdateSurveyStatus();
    });

    cron.schedule('*/5 * * * *', () => {
      this.checkAndUpdateAIAnalysis();
    });

    console.log('Survey status update cron jobs initialized');
  }
} 