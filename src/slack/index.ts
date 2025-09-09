import { initializeSlack, slackApp } from './config';
import { setupChannelSelection } from './handlers/surveyHandlers';
import { setupSurveyModalHandlers, setupSlackActions} from "./handlers/surveyModalHandlers"

export const initializeSlackIntegration = async () => {
  try {
    console.log('Starting Slack integration initialization...');
    
    // Khởi tạo Slack app
    await initializeSlack();
    
    console.log('Setting up Slack handlers...');
    
    // Thiết lập các handlers
    setupChannelSelection();
    console.log('Channel selection setup completed');
    
    setupSlackActions(slackApp);
    console.log('Slack actions setup completed');
    
    setupSurveyModalHandlers();
    console.log('Survey modal handlers setup completed');
    
    console.log('Slack integration initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Slack integration:', error);
    throw error;
  }
};