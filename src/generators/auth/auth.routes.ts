import fs from 'fs-extra';
import * as path from 'path';
import { AuthOptions } from './types.js';

/**
 * Auth Routes - Route definitions
 * 
 * Adapts based on authMode:
 * - email-password: includes /register, /login, /change-password routes
 * - oauth-only: includes /google route (no password routes)
 * - both: includes all routes
 */
export async function generateAuthRoutes(projectPath: string, options: AuthOptions, framework: 'express' | 'hono', ext: string) {
  const isTS = ext === 'ts';
  const { authMode } = options;
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

  const expressContent = isTS
    ? generateExpressTypeScriptRoutes(options, needsPassword, needsOAuth)
    : generateExpressJavaScriptRoutes(options, needsPassword, needsOAuth);

  const honoContent = isTS
    ? generateHonoTypeScriptRoutes(options, needsPassword, needsOAuth)
    : generateHonoJavaScriptRoutes(options, needsPassword, needsOAuth);

  const content = framework === 'hono' ? honoContent : expressContent;
  await fs.outputFile(path.join(projectPath, `src/auth/auth.routes.${ext}`), content);
}

function generateExpressTypeScriptRoutes(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Router } from 'express';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const router = Router();

${needsPassword ? `// Public routes - email/password auth
router.post('/register', authController.register);
router.post('/login', authController.login);
` : ''}
// Token management
router.post('/refresh', authController.refresh);

// JWKS endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

${options.forgotPassword && needsPassword ? `// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
` : ''}
${options.googleOAuth && needsOAuth ? `// OAuth routes
router.post('/google', authController.googleAuth);
` : ''}
// Protected routes
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);
${needsPassword ? `router.put('/change-password', authMiddleware, authController.changePassword);
` : ''}
export default router;
`;
}

function generateExpressJavaScriptRoutes(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Router } from 'express';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const router = Router();

${needsPassword ? `// Public routes - email/password auth
router.post('/register', authController.register);
router.post('/login', authController.login);
` : ''}
// Token management
router.post('/refresh', authController.refresh);

// JWKS endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

${options.forgotPassword && needsPassword ? `// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
` : ''}
${options.googleOAuth && needsOAuth ? `// OAuth routes
router.post('/google', authController.googleAuth);
` : ''}
// Protected routes
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);
${needsPassword ? `router.put('/change-password', authMiddleware, authController.changePassword);
` : ''}
export default router;
`;
}

function generateHonoTypeScriptRoutes(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Hono } from 'hono';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const auth = new Hono();

${needsPassword ? `// Public routes - email/password auth
auth.post('/register', authController.register);
auth.post('/login', authController.login);
` : ''}
// Token management
auth.post('/refresh', authController.refresh);

// JWKS endpoint
auth.get('/.well-known/jwks.json', (c) => c.json(getJWKS()));

${options.forgotPassword && needsPassword ? `// Password reset routes
auth.post('/forgot-password', authController.forgotPassword);
auth.post('/reset-password', authController.resetPassword);
` : ''}
${options.googleOAuth && needsOAuth ? `// OAuth routes
auth.post('/google', authController.googleAuth);
` : ''}
// Protected routes
auth.get('/me', authMiddleware, authController.me);
auth.post('/logout', authMiddleware, authController.logout);
${needsPassword ? `auth.put('/change-password', authMiddleware, authController.changePassword);
` : ''}
export default auth;
`;
}

function generateHonoJavaScriptRoutes(options: AuthOptions, needsPassword: boolean, needsOAuth: boolean): string {
  return `import { Hono } from 'hono';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const auth = new Hono();

${needsPassword ? `// Public routes - email/password auth
auth.post('/register', authController.register);
auth.post('/login', authController.login);
` : ''}
// Token management
auth.post('/refresh', authController.refresh);

// JWKS endpoint
auth.get('/.well-known/jwks.json', (c) => c.json(getJWKS()));

${options.forgotPassword && needsPassword ? `// Password reset routes
auth.post('/forgot-password', authController.forgotPassword);
auth.post('/reset-password', authController.resetPassword);
` : ''}
${options.googleOAuth && needsOAuth ? `// OAuth routes
auth.post('/google', authController.googleAuth);
` : ''}
// Protected routes
auth.get('/me', authMiddleware, authController.me);
auth.post('/logout', authMiddleware, authController.logout);
${needsPassword ? `auth.put('/change-password', authMiddleware, authController.changePassword);
` : ''}
export default auth;
`;
}
