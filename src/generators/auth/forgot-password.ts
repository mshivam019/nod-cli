import fs from 'fs-extra';
import * as path from 'path';
import { AuthOptions } from './types.js';

/**
 * Forgot Password Service - Password reset flow
 */
export async function generateForgotPasswordService(projectPath: string, options: AuthOptions, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { signResetToken, verifyResetToken } from './jwt.service.js';
import { hashPassword, validatePasswordStrength } from './password.service.js';
${options.emailService ? `import { sendPasswordResetEmail } from './email.service.js';` : ''}
import logger from '../utils/logger.js';

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

/**
 * Initiate forgot password flow
 * Generates reset token and sends email (if email service enabled)
 */
export async function initiateForgotPassword(
  userId: string,
  email: string
): Promise<ForgotPasswordResult> {
  try {
    // Generate reset token
    const resetToken = await signResetToken(userId, email);

    ${options.emailService ? `// Send password reset email
    await sendPasswordResetEmail(email, resetToken);` : `// TODO: Send reset token to user
    // For now, log it (remove in production)
    logger.info(\`Reset token for \${email}: \${resetToken}\`);`}

    return {
      success: true,
      message: 'Password reset instructions sent to your email'
    };
  } catch (error: any) {
    logger.error('Forgot password error:', error.message);
    throw error;
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  updatePasswordFn: (userId: string, hashedPassword: string) => Promise<void>
): Promise<ResetPasswordResult> {
  try {
    // Verify reset token
    const payload = await verifyResetToken(token);

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    await updatePasswordFn(payload.sub, hashedPassword);

    logger.info(\`Password reset successful for user: \${payload.sub}\`);

    return {
      success: true,
      message: 'Password has been reset successfully'
    };
  } catch (error: any) {
    logger.error('Reset password error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Reset token has expired. Please request a new one.');
    }

    throw error;
  }
}

export default {
  initiateForgotPassword,
  resetPassword
};
`
    : `import { signResetToken, verifyResetToken } from './jwt.service.js';
import { hashPassword, validatePasswordStrength } from './password.service.js';
${options.emailService ? `import { sendPasswordResetEmail } from './email.service.js';` : ''}
import logger from '../utils/logger.js';

/**
 * Initiate forgot password flow
 * Generates reset token and sends email (if email service enabled)
 */
export async function initiateForgotPassword(userId, email) {
  try {
    // Generate reset token
    const resetToken = await signResetToken(userId, email);

    ${options.emailService ? `// Send password reset email
    await sendPasswordResetEmail(email, resetToken);` : `// TODO: Send reset token to user
    // For now, log it (remove in production)
    logger.info(\`Reset token for \${email}: \${resetToken}\`);`}

    return {
      success: true,
      message: 'Password reset instructions sent to your email'
    };
  } catch (error) {
    logger.error('Forgot password error:', error.message);
    throw error;
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(token, newPassword, updatePasswordFn) {
  try {
    // Verify reset token
    const payload = await verifyResetToken(token);

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    await updatePasswordFn(payload.sub, hashedPassword);

    logger.info(\`Password reset successful for user: \${payload.sub}\`);

    return {
      success: true,
      message: 'Password has been reset successfully'
    };
  } catch (error) {
    logger.error('Reset password error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Reset token has expired. Please request a new one.');
    }

    throw error;
  }
}

export default {
  initiateForgotPassword,
  resetPassword
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/forgot-password.service.${ext}`), content);
}
