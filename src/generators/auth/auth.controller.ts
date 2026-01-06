import fs from 'fs-extra';
import * as path from 'path';
import { AuthOptions } from './types.js';

/**
 * Auth Controller - Route handlers
 * 
 * Adapts based on authMode:
 * - email-password: includes register, login, changePassword handlers
 * - oauth-only: includes googleAuth handler (uses authenticateOAuth)
 * - both: includes all handlers
 */
export async function generateAuthController(projectPath: string, options: AuthOptions, framework: 'express' | 'hono', ext: string) {
  const isTS = ext === 'ts';
  const { authMode } = options;
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

  const expressContent = isTS
    ? generateExpressTypeScriptController(options, needsPassword, needsOAuth)
    : generateExpressJavaScriptController(options, needsPassword, needsOAuth);

  const honoContent = isTS
    ? generateHonoTypeScriptController(options, needsPassword, needsOAuth)
    : generateHonoJavaScriptController(options, needsPassword, needsOAuth);

  const content = framework === 'hono' ? honoContent : expressContent;
  await fs.outputFile(path.join(projectPath, `src/auth/auth.controller.${ext}`), content);
}

function generateExpressTypeScriptController(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import authService from './auth.service.js';
${options.forgotPassword && needsPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth && needsOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

${needsPassword ? `/**
 * Register new user
 * POST /auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.register({ email, password, name });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    logger.error('Register controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Login user
 * POST /auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.login({ email, password });

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Login controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Change password
 * PUT /auth/change-password
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.sub;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const result = await authService.changePassword({
      userId,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Change password controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
` : ''}
/**
 * Refresh tokens
 * POST /auth/refresh
 */
export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Refresh controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.sub;

    if (userId) {
      await authService.logout(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    logger.error('Logout controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get current user
 * GET /auth/me
 */
export const me = async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error: any) {
    logger.error('Me controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

${options.forgotPassword && needsPassword ? `/**
 * Forgot password
 * POST /auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // TODO: Look up user by email and get their ID
    // For security, always return success even if user not found
    // const user = await findUserByEmail(email);
    // if (user) {
    //   await initiateForgotPassword(user.id, email);
    // }

    return res.status(200).json({
      success: true,
      message: 'If an account exists, password reset instructions have been sent'
    });
  } catch (error: any) {
    logger.error('Forgot password controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reset password
 * POST /auth/reset-password
 */
export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // TODO: Implement updatePasswordFn to update password in database
    const result = await resetPassword(token, newPassword, async (userId, hashedPassword) => {
      // await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
      throw new Error('updatePasswordFn not implemented');
    });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Reset password controller error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to reset password'
    });
  }
};` : ''}

${options.googleOAuth && needsOAuth ? `/**
 * Google OAuth login
 * POST /auth/google
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    // Verify Google token
    const googleUser = await verifyGoogleToken(idToken);

    // Authenticate via OAuth service
    const result = await authService.authenticateOAuth({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      emailVerified: googleUser.emailVerified
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Google auth controller error:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Google authentication failed'
    });
  }
};` : ''}

export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
  refresh,
  logout,
  me${options.forgotPassword && needsPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth && needsOAuth ? `,
  googleAuth` : ''}
};
`;
}

function generateExpressJavaScriptController(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import authService from './auth.service.js';
${options.forgotPassword && needsPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth && needsOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

${needsPassword ? `/**
 * Register new user
 * POST /auth/register
 */
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.register({ email, password, name });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    logger.error('Register controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Login user
 * POST /auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const result = await authService.login({ email, password });

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Login controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Change password
 * PUT /auth/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const result = await authService.changePassword({
      userId,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Change password controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
` : ''}
/**
 * Refresh tokens
 * POST /auth/refresh
 */
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Refresh controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (req, res) => {
  try {
    const userId = req.user?.sub;

    if (userId) {
      await authService.logout(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get current user
 * GET /auth/me
 */
export const me = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    logger.error('Me controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

${options.forgotPassword && needsPassword ? `/**
 * Forgot password
 * POST /auth/forgot-password
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists, password reset instructions have been sent'
    });
  } catch (error) {
    logger.error('Forgot password controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reset password
 * POST /auth/reset-password
 */
export const resetPasswordHandler = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    const result = await resetPassword(token, newPassword, async (userId, hashedPassword) => {
      throw new Error('updatePasswordFn not implemented');
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Reset password controller error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to reset password'
    });
  }
};` : ''}

${options.googleOAuth && needsOAuth ? `/**
 * Google OAuth login
 * POST /auth/google
 */
export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    const googleUser = await verifyGoogleToken(idToken);

    const result = await authService.authenticateOAuth({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      emailVerified: googleUser.emailVerified
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Google auth controller error:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Google authentication failed'
    });
  }
};` : ''}

export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
  refresh,
  logout,
  me${options.forgotPassword && needsPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth && needsOAuth ? `,
  googleAuth` : ''}
};
`;
}

function generateHonoTypeScriptController(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Context } from 'hono';
import authService from './auth.service.js';
${options.forgotPassword && needsPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth && needsOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

${needsPassword ? `/**
 * Register new user
 * POST /auth/register
 */
export const register = async (c: Context) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password) {
      return c.json({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    const result = await authService.register({ email, password, name });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 201);
  } catch (error: any) {
    logger.error('Register controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Login user
 * POST /auth/login
 */
export const login = async (c: Context) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    const result = await authService.login({ email, password });

    if (!result.success) {
      return c.json(result, 401);
    }

    return c.json(result, 200);
  } catch (error: any) {
    logger.error('Login controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Change password
 * PUT /auth/change-password
 */
export const changePassword = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    const { currentPassword, newPassword } = await c.req.json();

    if (!userId) {
      return c.json({
        success: false,
        message: 'User not authenticated'
      }, 401);
    }

    if (!currentPassword || !newPassword) {
      return c.json({
        success: false,
        message: 'Current password and new password are required'
      }, 400);
    }

    const result = await authService.changePassword({
      userId,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 200);
  } catch (error: any) {
    logger.error('Change password controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};
` : ''}
/**
 * Refresh tokens
 * POST /auth/refresh
 */
export const refresh = async (c: Context) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({
        success: false,
        message: 'Refresh token is required'
      }, 400);
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      return c.json(result, 401);
    }

    return c.json(result, 200);
  } catch (error: any) {
    logger.error('Refresh controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;

    if (userId) {
      await authService.logout(userId);
    }

    return c.json({
      success: true,
      message: 'Logged out successfully'
    }, 200);
  } catch (error: any) {
    logger.error('Logout controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Get current user
 * GET /auth/me
 */
export const me = async (c: Context) => {
  try {
    const user = c.get('user');
    return c.json({
      success: true,
      user
    }, 200);
  } catch (error: any) {
    logger.error('Me controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

${options.forgotPassword && needsPassword ? `/**
 * Forgot password
 * POST /auth/forgot-password
 */
export const forgotPassword = async (c: Context) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        success: false,
        message: 'Email is required'
      }, 400);
    }

    return c.json({
      success: true,
      message: 'If an account exists, password reset instructions have been sent'
    }, 200);
  } catch (error: any) {
    logger.error('Forgot password controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Reset password
 * POST /auth/reset-password
 */
export const resetPasswordHandler = async (c: Context) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({
        success: false,
        message: 'Token and new password are required'
      }, 400);
    }

    const result = await resetPassword(token, newPassword, async (userId, hashedPassword) => {
      throw new Error('updatePasswordFn not implemented');
    });

    return c.json(result, 200);
  } catch (error: any) {
    logger.error('Reset password controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Failed to reset password'
    }, 400);
  }
};` : ''}

${options.googleOAuth && needsOAuth ? `/**
 * Google OAuth login
 * POST /auth/google
 */
export const googleAuth = async (c: Context) => {
  try {
    const { idToken } = await c.req.json();

    if (!idToken) {
      return c.json({
        success: false,
        message: 'Google ID token is required'
      }, 400);
    }

    const googleUser = await verifyGoogleToken(idToken);

    const result = await authService.authenticateOAuth({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      emailVerified: googleUser.emailVerified
    });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 200);
  } catch (error: any) {
    logger.error('Google auth controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Google authentication failed'
    }, 401);
  }
};` : ''}

export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
  refresh,
  logout,
  me${options.forgotPassword && needsPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth && needsOAuth ? `,
  googleAuth` : ''}
};
`;
}

function generateHonoJavaScriptController(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import authService from './auth.service.js';
${options.forgotPassword && needsPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth && needsOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

${needsPassword ? `/**
 * Register new user
 * POST /auth/register
 */
export const register = async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password) {
      return c.json({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    const result = await authService.register({ email, password, name });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 201);
  } catch (error) {
    logger.error('Register controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Login user
 * POST /auth/login
 */
export const login = async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    const result = await authService.login({ email, password });

    if (!result.success) {
      return c.json(result, 401);
    }

    return c.json(result, 200);
  } catch (error) {
    logger.error('Login controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Change password
 * PUT /auth/change-password
 */
export const changePassword = async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;
    const { currentPassword, newPassword } = await c.req.json();

    if (!userId) {
      return c.json({
        success: false,
        message: 'User not authenticated'
      }, 401);
    }

    if (!currentPassword || !newPassword) {
      return c.json({
        success: false,
        message: 'Current password and new password are required'
      }, 400);
    }

    const result = await authService.changePassword({
      userId,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 200);
  } catch (error) {
    logger.error('Change password controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};
` : ''}
/**
 * Refresh tokens
 * POST /auth/refresh
 */
export const refresh = async (c) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({
        success: false,
        message: 'Refresh token is required'
      }, 400);
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      return c.json(result, 401);
    }

    return c.json(result, 200);
  } catch (error) {
    logger.error('Refresh controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (c) => {
  try {
    const user = c.get('user');
    const userId = user?.sub;

    if (userId) {
      await authService.logout(userId);
    }

    return c.json({
      success: true,
      message: 'Logged out successfully'
    }, 200);
  } catch (error) {
    logger.error('Logout controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Get current user
 * GET /auth/me
 */
export const me = async (c) => {
  try {
    const user = c.get('user');
    return c.json({
      success: true,
      user
    }, 200);
  } catch (error) {
    logger.error('Me controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

${options.forgotPassword && needsPassword ? `/**
 * Forgot password
 * POST /auth/forgot-password
 */
export const forgotPassword = async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        success: false,
        message: 'Email is required'
      }, 400);
    }

    return c.json({
      success: true,
      message: 'If an account exists, password reset instructions have been sent'
    }, 200);
  } catch (error) {
    logger.error('Forgot password controller error:', error.message);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
};

/**
 * Reset password
 * POST /auth/reset-password
 */
export const resetPasswordHandler = async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({
        success: false,
        message: 'Token and new password are required'
      }, 400);
    }

    const result = await resetPassword(token, newPassword, async (userId, hashedPassword) => {
      throw new Error('updatePasswordFn not implemented');
    });

    return c.json(result, 200);
  } catch (error) {
    logger.error('Reset password controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Failed to reset password'
    }, 400);
  }
};` : ''}

${options.googleOAuth && needsOAuth ? `/**
 * Google OAuth login
 * POST /auth/google
 */
export const googleAuth = async (c) => {
  try {
    const { idToken } = await c.req.json();

    if (!idToken) {
      return c.json({
        success: false,
        message: 'Google ID token is required'
      }, 400);
    }

    const googleUser = await verifyGoogleToken(idToken);

    const result = await authService.authenticateOAuth({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      emailVerified: googleUser.emailVerified
    });

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result, 200);
  } catch (error) {
    logger.error('Google auth controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Google authentication failed'
    }, 401);
  }
};` : ''}

export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
  refresh,
  logout,
  me${options.forgotPassword && needsPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth && needsOAuth ? `,
  googleAuth` : ''}
};
`;
}
