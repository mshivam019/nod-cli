import fs from 'fs-extra';
import * as path from 'path';
import { AuthOptions } from './types.js';

/**
 * Main Auth Service - Orchestrates all auth operations
 * 
 * Adapts based on authMode:
 * - email-password: includes register, login, changePassword (uses password service)
 * - oauth-only: includes authenticateOAuth (no password operations)
 * - both: includes all operations
 */
export async function generateAuthService(projectPath: string, options: AuthOptions, ext: string) {
  const isTS = ext === 'ts';
  const { authMode } = options;
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

  const content = isTS
    ? generateTypeScriptAuthService(options, needsPassword, needsOAuth)
    : generateJavaScriptAuthService(options, needsPassword, needsOAuth);

  await fs.outputFile(path.join(projectPath, `src/auth/auth.service.${ext}`), content);
}

function generateTypeScriptAuthService(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  const imports = [
    `import { generateTokenPair, verifyRefreshToken, TokenPair } from './jwt.service.js';`,
    needsPassword ? `import { hashPassword, verifyPassword, validatePasswordStrength } from './password.service.js';` : '',
    options.emailService ? `import { sendWelcomeEmail } from './email.service.js';` : '',
    `import logger from '../utils/logger.js';`,
  ].filter(Boolean).join('\n');

  const interfaces = `
${needsPassword ? `export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ChangePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}
` : ''}
${needsOAuth ? `export interface OAuthUserData {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}
` : ''}
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  tokens?: TokenPair;
  message?: string;
}

// TODO: Replace with your actual database functions
interface UserRecord {
  id: string;
  email: string;
  name?: string;
${needsPassword ? '  password_hash: string;' : ''}
${needsOAuth ? '  google_id?: string;' : ''}
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE email = $1', [email]);
  throw new Error('findUserByEmail not implemented - connect to your database');
}

async function findUserById(id: string): Promise<UserRecord | null> {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE id = $1', [id]);
  throw new Error('findUserById not implemented - connect to your database');
}
${needsPassword ? `
async function createUserInDb(email: string, passwordHash: string, name?: string): Promise<UserRecord> {
  // TODO: Implement database insert
  // Example: return await db.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *', [email, passwordHash, name]);
  throw new Error('createUserInDb not implemented - connect to your database');
}

async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  // TODO: Implement database update
  // Example: await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  throw new Error('updateUserPassword not implemented - connect to your database');
}
` : ''}
${needsOAuth ? `
async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  throw new Error('findUserByGoogleId not implemented - connect to your database');
}

async function createOAuthUser(data: OAuthUserData): Promise<UserRecord> {
  // TODO: Implement database insert for OAuth users
  // Example: return await db.query('INSERT INTO users (email, google_id, name, email_verified) VALUES ($1, $2, $3, $4) RETURNING *', [data.email, data.googleId, data.name, data.emailVerified]);
  throw new Error('createOAuthUser not implemented - connect to your database');
}

async function linkGoogleIdToUser(userId: string, googleId: string): Promise<void> {
  // TODO: Implement database update to link Google ID
  // Example: await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
  throw new Error('linkGoogleIdToUser not implemented - connect to your database');
}
` : ''}`;

  const passwordFunctions = needsPassword ? `
/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<AuthResult> {
  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(data.email);
    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists'
      };
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.errors.join(', ')
      };
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(data.password);

    // Create user in database
    const user = await createUserInDb(data.email, passwordHash, data.name);

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    ${options.emailService ? `// Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      logger.warn('Failed to send welcome email:', emailError);
    }` : ''}

    logger.info(\`User registered: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error: any) {
    logger.error('Registration error:', error.message);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(data: LoginData): Promise<AuthResult> {
  try {
    // Find user by email
    const user = await findUserByEmail(data.email);
    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Verify password using bcrypt
    const isValidPassword = await verifyPassword(data.password, user.password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    logger.info(\`User logged in: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error: any) {
    logger.error('Login error:', error.message);
    throw error;
  }
}

/**
 * Change user password
 */
export async function changePassword(data: ChangePasswordData): Promise<AuthResult> {
  try {
    // Find user by ID
    const user = await findUserById(data.userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Verify current password
    const isValidPassword = await verifyPassword(data.currentPassword, user.password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Current password is incorrect'
      };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(data.newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.errors.join(', ')
      };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(data.newPassword);

    // Update password in database
    await updateUserPassword(data.userId, newPasswordHash);

    logger.info(\`Password changed for user: \${user.email}\`);

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error: any) {
    logger.error('Change password error:', error.message);
    throw error;
  }
}
` : '';

  const oauthFunctions = needsOAuth ? `
/**
 * Authenticate via OAuth (Google)
 * Finds existing user by Google ID, links to existing email user, or creates new OAuth user
 */
export async function authenticateOAuth(oauthData: OAuthUserData): Promise<AuthResult> {
  try {
    // First, try to find user by Google ID
    let user = await findUserByGoogleId(oauthData.googleId);

    if (!user) {
      // Check if user exists with this email (for linking)
      const existingUser = await findUserByEmail(oauthData.email);
      
      if (existingUser) {
        // Link Google ID to existing user
        await linkGoogleIdToUser(existingUser.id, oauthData.googleId);
        user = existingUser;
        logger.info(\`Linked Google account to existing user: \${user.email}\`);
      } else {
        // Create new OAuth user
        user = await createOAuthUser(oauthData);
        logger.info(\`Created new OAuth user: \${user.email}\`);
        
        ${options.emailService ? `// Send welcome email
        try {
          await sendWelcomeEmail(user.email, user.name);
        } catch (emailError) {
          logger.warn('Failed to send welcome email:', emailError);
        }` : ''}
      }
    }

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    logger.info(\`OAuth login successful: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error: any) {
    logger.error('OAuth authentication error:', error.message);
    throw error;
  }
}
` : '';

  const commonFunctions = `
/**
 * Refresh access token
 */
export async function refreshToken(token: string): Promise<AuthResult> {
  try {
    const payload = await verifyRefreshToken(token);

    // Find user to ensure they still exist
    const user = await findUserById(payload.sub);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Generate new tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error: any) {
    logger.error('Token refresh error:', error.message);
    return {
      success: false,
      message: 'Invalid or expired refresh token'
    };
  }
}

/**
 * Logout (client-side token removal, optional server-side blacklist)
 */
export async function logout(userId: string): Promise<void> {
  // TODO: Optionally implement token blacklisting
  // For now, logout is handled client-side by removing tokens
  logger.info(\`User logged out: \${userId}\`);
}
`;

  const defaultExport = `
export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
${needsOAuth ? `  authenticateOAuth,` : ''}
  refreshToken,
  logout
};
`;

  return `${imports}
${interfaces}
${passwordFunctions}
${oauthFunctions}
${commonFunctions}
${defaultExport}`;
}

function generateJavaScriptAuthService(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  const imports = [
    `import { generateTokenPair, verifyRefreshToken } from './jwt.service.js';`,
    needsPassword ? `import { hashPassword, verifyPassword, validatePasswordStrength } from './password.service.js';` : '',
    options.emailService ? `import { sendWelcomeEmail } from './email.service.js';` : '',
    `import logger from '../utils/logger.js';`,
  ].filter(Boolean).join('\n');

  const dbFunctions = `
// TODO: Replace with your actual database functions
async function findUserByEmail(email) {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE email = $1', [email]);
  throw new Error('findUserByEmail not implemented - connect to your database');
}

async function findUserById(id) {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE id = $1', [id]);
  throw new Error('findUserById not implemented - connect to your database');
}
${needsPassword ? `
async function createUserInDb(email, passwordHash, name) {
  // TODO: Implement database insert
  // Example: return await db.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *', [email, passwordHash, name]);
  throw new Error('createUserInDb not implemented - connect to your database');
}

async function updateUserPassword(userId, passwordHash) {
  // TODO: Implement database update
  // Example: await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  throw new Error('updateUserPassword not implemented - connect to your database');
}
` : ''}
${needsOAuth ? `
async function findUserByGoogleId(googleId) {
  // TODO: Implement database lookup
  // Example: return await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  throw new Error('findUserByGoogleId not implemented - connect to your database');
}

async function createOAuthUser(data) {
  // TODO: Implement database insert for OAuth users
  // Example: return await db.query('INSERT INTO users (email, google_id, name, email_verified) VALUES ($1, $2, $3, $4) RETURNING *', [data.email, data.googleId, data.name, data.emailVerified]);
  throw new Error('createOAuthUser not implemented - connect to your database');
}

async function linkGoogleIdToUser(userId, googleId) {
  // TODO: Implement database update to link Google ID
  // Example: await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
  throw new Error('linkGoogleIdToUser not implemented - connect to your database');
}
` : ''}`;

  const passwordFunctions = needsPassword ? `
/**
 * Register a new user
 */
export async function register(data) {
  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(data.email);
    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists'
      };
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.errors.join(', ')
      };
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(data.password);

    // Create user in database
    const user = await createUserInDb(data.email, passwordHash, data.name);

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    ${options.emailService ? `// Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      logger.warn('Failed to send welcome email:', emailError);
    }` : ''}

    logger.info(\`User registered: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error) {
    logger.error('Registration error:', error.message);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(data) {
  try {
    // Find user by email
    const user = await findUserByEmail(data.email);
    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Verify password using bcrypt
    const isValidPassword = await verifyPassword(data.password, user.password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    logger.info(\`User logged in: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error) {
    logger.error('Login error:', error.message);
    throw error;
  }
}

/**
 * Change user password
 */
export async function changePassword(data) {
  try {
    // Find user by ID
    const user = await findUserById(data.userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Verify current password
    const isValidPassword = await verifyPassword(data.currentPassword, user.password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Current password is incorrect'
      };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(data.newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.errors.join(', ')
      };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(data.newPassword);

    // Update password in database
    await updateUserPassword(data.userId, newPasswordHash);

    logger.info(\`Password changed for user: \${user.email}\`);

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    logger.error('Change password error:', error.message);
    throw error;
  }
}
` : '';

  const oauthFunctions = needsOAuth ? `
/**
 * Authenticate via OAuth (Google)
 * Finds existing user by Google ID, links to existing email user, or creates new OAuth user
 */
export async function authenticateOAuth(oauthData) {
  try {
    // First, try to find user by Google ID
    let user = await findUserByGoogleId(oauthData.googleId);

    if (!user) {
      // Check if user exists with this email (for linking)
      const existingUser = await findUserByEmail(oauthData.email);
      
      if (existingUser) {
        // Link Google ID to existing user
        await linkGoogleIdToUser(existingUser.id, oauthData.googleId);
        user = existingUser;
        logger.info(\`Linked Google account to existing user: \${user.email}\`);
      } else {
        // Create new OAuth user
        user = await createOAuthUser(oauthData);
        logger.info(\`Created new OAuth user: \${user.email}\`);
        
        ${options.emailService ? `// Send welcome email
        try {
          await sendWelcomeEmail(user.email, user.name);
        } catch (emailError) {
          logger.warn('Failed to send welcome email:', emailError);
        }` : ''}
      }
    }

    // Generate tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    logger.info(\`OAuth login successful: \${user.email}\`);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error) {
    logger.error('OAuth authentication error:', error.message);
    throw error;
  }
}
` : '';

  const commonFunctions = `
/**
 * Refresh access token
 */
export async function refreshToken(token) {
  try {
    const payload = await verifyRefreshToken(token);

    // Find user to ensure they still exist
    const user = await findUserById(payload.sub);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Generate new tokens
    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      name: user.name
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens
    };
  } catch (error) {
    logger.error('Token refresh error:', error.message);
    return {
      success: false,
      message: 'Invalid or expired refresh token'
    };
  }
}

/**
 * Logout (client-side token removal, optional server-side blacklist)
 */
export async function logout(userId) {
  // TODO: Optionally implement token blacklisting
  // For now, logout is handled client-side by removing tokens
  logger.info(\`User logged out: \${userId}\`);
}
`;

  const defaultExport = `
export default {
${needsPassword ? `  register,
  login,
  changePassword,` : ''}
${needsOAuth ? `  authenticateOAuth,` : ''}
  refreshToken,
  logout
};
`;

  return `${imports}
${dbFunctions}
${passwordFunctions}
${oauthFunctions}
${commonFunctions}
${defaultExport}`;
}
