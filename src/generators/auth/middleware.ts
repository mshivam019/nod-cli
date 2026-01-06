import fs from 'fs-extra';
import path from 'path';

/**
 * Auth Middleware - Verify JWT from Authorization header
 */
export async function generateAuthMiddleware(projectPath: string, framework: 'express' | 'hono', ext: string) {
  const isTS = ext === 'ts';

  const expressContent = isTS
    ? `import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * JWT Authentication Middleware
 * Verifies access tokens using custom JWKS
 */
const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
export const optionalAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyAccessToken(token);
      req.user = payload;
    }

    next();
  } catch {
    // Token invalid but optional, continue without user
    next();
  }
};

export default authMiddleware;
`
    : `import { verifyAccessToken } from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

/**
 * JWT Authentication Middleware
 * Verifies access tokens using custom JWKS
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyAccessToken(token);
      req.user = payload;
    }

    next();
  } catch {
    // Token invalid but optional, continue without user
    next();
  }
};

export default authMiddleware;
`;

  const honoContent = isTS
    ? `import { Context, Next } from 'hono';
import { verifyAccessToken, TokenPayload } from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

/**
 * JWT Authentication Middleware for Hono
 * Verifies access tokens using custom JWKS
 */
const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    c.set('user', payload);
    await next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return c.json({
        success: false,
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      }, 401);
    }

    return c.json({
      success: false,
      message: 'Invalid or expired token.'
    }, 401);
  }
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyAccessToken(token);
      c.set('user', payload);
    }

    await next();
  } catch {
    // Token invalid but optional, continue without user
    await next();
  }
};

export default authMiddleware;
`
    : `import { verifyAccessToken } from '../auth/jwt.service.js';
import logger from '../utils/logger.js';

/**
 * JWT Authentication Middleware for Hono
 * Verifies access tokens using custom JWKS
 */
const authMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    c.set('user', payload);
    await next();
  } catch (error) {
    logger.error('Auth middleware error:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return c.json({
        success: false,
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      }, 401);
    }

    return c.json({
      success: false,
      message: 'Invalid or expired token.'
    }, 401);
  }
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
export const optionalAuthMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyAccessToken(token);
      c.set('user', payload);
    }

    await next();
  } catch {
    // Token invalid but optional, continue without user
    await next();
  }
};

export default authMiddleware;
`;

  const content = framework === 'hono' ? honoContent : expressContent;
  await fs.outputFile(path.join(projectPath, `src/middleware/auth.middleware.${ext}`), content);
}
