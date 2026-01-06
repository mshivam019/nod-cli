import fs from 'fs-extra';
import * as path from 'path';

/**
 * Email Service - Nodemailer with templates
 */
export async function generateEmailService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface TransporterConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const transporterConfig: TransporterConfig = {
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser || '',
        pass: config.smtpPassword || ''
      }
    };

    transporter = nodemailer.createTransport(transporterConfig);
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();

  const mailOptions = {
    from: config.smtpFrom || config.smtpUser,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  };

  try {
    await transport.sendMail(mailOptions);
    logger.info(\`Email sent to \${options.to}\`);
  } catch (error: any) {
    logger.error(\`Failed to send email to \${options.to}:\`, error.message);
    throw new Error(\`Failed to send email: \${error.message}\`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = \`\${config.appUrl}/reset-password?token=\${resetToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Reset Your Password</h1>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="\${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </body>
    </html>
  \`;

  const text = \`Reset Your Password\\n\\nYou requested a password reset. Visit the following link to reset your password:\\n\\n\${resetUrl}\\n\\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.\`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<void> {
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome!</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Welcome\${name ? \`, \${name}\` : ''}!</h1>
      <p>Thank you for signing up. We're excited to have you on board.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p style="color: #999; font-size: 12px;">Best regards,<br>The Team</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Welcome!',
    html
  });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
  const verifyUrl = \`\${config.appUrl}/verify-email?token=\${verificationToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Verify Your Email</h1>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="\${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${verifyUrl}</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html
  });
}

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail
};
`
    : `import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let transporter = null;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (!transporter) {
    const transporterConfig = {
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser || '',
        pass: config.smtpPassword || ''
      }
    };

    transporter = nodemailer.createTransport(transporterConfig);
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options) {
  const transport = getTransporter();

  const mailOptions = {
    from: config.smtpFrom || config.smtpUser,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  };

  try {
    await transport.sendMail(mailOptions);
    logger.info(\`Email sent to \${options.to}\`);
  } catch (error) {
    logger.error(\`Failed to send email to \${options.to}:\`, error.message);
    throw new Error(\`Failed to send email: \${error.message}\`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = \`\${config.appUrl}/reset-password?token=\${resetToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Reset Your Password</h1>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="\${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </body>
    </html>
  \`;

  const text = \`Reset Your Password\\n\\nYou requested a password reset. Visit the following link to reset your password:\\n\\n\${resetUrl}\\n\\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.\`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email, name) {
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome!</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Welcome\${name ? \`, \${name}\` : ''}!</h1>
      <p>Thank you for signing up. We're excited to have you on board.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p style="color: #999; font-size: 12px;">Best regards,<br>The Team</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Welcome!',
    html
  });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email, verificationToken) {
  const verifyUrl = \`\${config.appUrl}/verify-email?token=\${verificationToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Verify Your Email</h1>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="\${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${verifyUrl}</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html
  });
}

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/email.service.${ext}`), content);
}
