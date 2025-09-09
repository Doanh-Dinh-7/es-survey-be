import { PrismaClient, QuestionType, SurveyStatus, AutoCloseCondition } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.answerOption.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.surveySetting.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.user.deleteMany();

  // Create system survey templates (userId is null)
  const templates = [
    {
      title: 'Customer Satisfaction Survey',
      description: 'A template to measure customer satisfaction with your product or service.',
      isTemplate: true,
      questions: {
        create: [
          {
            questionText: 'How satisfied are you with our product?',
            type: QuestionType.multiple_choice,
            order: 1,
            options: { create: [{ optionText: 'Very Satisfied' }, { optionText: 'Satisfied' }, { optionText: 'Neutral' }, { optionText: 'Dissatisfied' }, { optionText: 'Very Dissatisfied' }] }
          },
          {
            questionText: 'What features do you like the most?',
            type: QuestionType.checkbox,
            order: 2,
            options: { create: [{ optionText: 'Feature A' }, { optionText: 'Feature B' }, { optionText: 'Feature C' }] }
          },
          {
            questionText: 'Any suggestions for improvement?',
            type: QuestionType.long_text,
            order: 3
          }
        ]
      },
      settings: { create: { responseLetter: 'Thank you for your feedback!' } }
    },
    {
      title: 'Employee Engagement Survey',
      description: 'A template to gauge employee engagement and workplace satisfaction.',
      isTemplate: true,
      questions: {
        create: [
          {
            questionText: 'On a scale of 1-10, how likely are you to recommend our company as a great place to work?',
            type: QuestionType.multiple_choice,
            order: 1,
            options: { create: Array.from({ length: 10 }, (_, i) => ({ optionText: `${i + 1}` })) }
          },
          {
            questionText: 'What do you enjoy most about working here?',
            type: QuestionType.long_text,
            order: 2
          }
        ]
      },
      settings: { create: { responseLetter: 'Your feedback is valuable to us.' } }
    }
  ];

  for (const template of templates) {
    await prisma.survey.create({
      data: {
        ...template,
        status: SurveyStatus.PENDING, // Templates are not published by default
        userId: null // System template
      }
    });
  }

  console.log('Database has been seeded with system survey templates.');
}

main();
