import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailProps {
  email: string;
  subject: string;
  html: string;
}

interface SendVerificationEmailProps {
  email: string;
  token: string;
}

export const sendResetEmail = async ({ email, token }: SendVerificationEmailProps): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Reset Your Password – Survey App',
    html: `
      <p>Hi,</p>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>Thanks,<br>Survey App Team</p>
    `,
  });

  console.log(`📧 Sent reset password email to ${email}`);
};

export const sendEmail = async ({ email, subject, html }: SendEmailProps): Promise<void> => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject,
    html,
  });
};