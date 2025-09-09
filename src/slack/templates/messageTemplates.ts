export interface SurveyInfo {
  title: string;
  description: string;
  publishedAt?: Date;
  closeAt?: Date;
  createdBy: string;
  surveyId: string;
  customMessage?: string;
  responseCount?: number;
  maxResponse?: number;
}

const formatDate = (date?: Date | string | null): string => {
  if (!date) return 'Not Set';

  try {
    let parsed: Date;
    
    if (typeof date === 'string') {
      parsed = new Date(date);
    } else if (date instanceof Date) {
      parsed = date;
    } else {
      return 'Invalid Date';
    }

    if (isNaN(parsed.getTime())) return 'Invalid Date';

    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Invalid Date';
  }
};

export const createNewSurveyMessage = (survey: SurveyInfo) => ({
  blocks: [
    ...(survey.customMessage
      ? [{
          type: "section",
          text: { type: "mrkdwn", text: survey.customMessage }
        }, { type: "divider" }]
      : []),
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 New Survey Available",
        emoji: true
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${survey.title}*\n${survey.description}`
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `👤 Created by: ${survey.createdBy}\n🕒 Published at: ${formatDate(survey.publishedAt)}\n🕒 Closing at: ${formatDate(survey.closeAt)}`
        }
      ]
    },
    {
      type: "divider"
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Take Survey in Slack",
            emoji: true
          },
          action_id: "open_survey",
          value: survey.surveyId,
          style: "primary"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open in Browser",
            emoji: true
          },
          url: `${process.env.FRONTEND_URL}/survey-preview/${survey.surveyId}`
        }
      ]
    }
  ]
});

export const createSurveyClosedMessage = (survey: SurveyInfo) => ({
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🔒 Survey Closed",
        emoji: true
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${survey.title}*\n${survey.description}`
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `👤 Created by: ${survey.createdBy}`
        }
      ]
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📊 *Survey Results*\n• Total Responses: " + (survey.responseCount || 0) + 
              (survey.maxResponse ? ` / ${survey.maxResponse}` : '')
      }
    }
  ]
});

export const createSurveyClosingSoonDM = (survey: SurveyInfo) => ({
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⏰ Survey Closing Soon",
        emoji: true
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${survey.title}*\n${survey.description}`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📊 *Current Status*\n" +
              `• Responses: ${survey.responseCount || 0}${survey.maxResponse ? ` / ${survey.maxResponse}` : ''}\n` +
              `• Closing Date: ${formatDate(survey.closeAt)}`
      }
    },
    {
      type: "divider"
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Survey",
            emoji: true
          },
          url: `${process.env.FRONTEND_URL}/survey-preview/${survey.surveyId}`,
          style: "primary"
        }
      ]
    }
  ]
});

export const createSurveyClosedDM = (survey: SurveyInfo) => ({
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ Survey Closed",
        emoji: true
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${survey.title}*\n${survey.description}`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📊 *Final Results*\n" +
              `• Total Responses: ${survey.responseCount || 0}${survey.maxResponse ? ` / ${survey.maxResponse}` : ''}\n` +
              `• Closed Date: ${formatDate(survey.closeAt)}`
      }
    },
    {
      type: "divider"
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Results",
            emoji: true
          },
          url: `${process.env.FRONTEND_URL}/survey-result/${survey.surveyId}`,
          style: "primary"
        }
      ]
    }
  ]
});
