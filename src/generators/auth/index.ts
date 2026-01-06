import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Re-export types
export { AuthOptions } from './types.js';

// Import all generators
import { generateJWKSService } from './jwks.service.js';
import { generateJWTService } from './jwt.service.js';
import { generatePasswordService } from './password.service.js';
import { generateAuthMiddleware } from './middleware.js';
import { generateSupabaseAdminAuthService } from './supabase-admin.js';
import { generateForgotPasswordService } from './forgot-password.js';
import { generateEmailService } from './email.service.js';
import { generateGoogleOAuthService } from './google-oauth.js';
import { generateAuthService } from './auth.service.js';
import { generateAuthController } from './auth.controller.js';
import { generateAuthRoutes } from './auth.routes.js';
import { generateAuthSchema } from './schema.js';
import { generateAuthConfig } from './config.js';
import { AuthOptions } from './types.js';

/**
 * Main auth generator - orchestrates all auth module generation
 * 
 * Generates a complete authentication module based on options:
 * - JWKS service for key management
 * - JWT service for token generation/verification
 * - Password service (if authMode needs password)
 * - Auth middleware
 * - Optional: Supabase admin, forgot password, email, Google OAuth
 * - Auth service with authMode-aware functions
 * - Auth controller with authMode-aware handlers
 * - Auth routes with authMode-aware routes
 * - Auth schema adapted to authMode
 * - Config updates (.env, .gitignore, nod.config.json)
 */
export async function generateAuth(
  projectPath: string,
  options: AuthOptions,
  extOverride?: string
) {
  const ext = extOverride || await getProjectExtension(projectPath);
  const framework = options.framework || 'express';
  const { authMode } = options;
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

  console.log(chalk.blue('\n📦 Generating auth module...'));
  console.log(chalk.gray(`  Auth mode: ${authMode}`));
  console.log(chalk.gray(`  Framework: ${framework}`));
  console.log(chalk.gray(`  Extension: ${ext}`));

  // Create auth directory
  await fs.ensureDir(path.join(projectPath, 'src/auth'));

  // Core services (always generated)
  console.log(chalk.gray('  Generating JWKS service...'));
  await generateJWKSService(projectPath, ext);

  console.log(chalk.gray('  Generating JWT service...'));
  await generateJWTService(projectPath, ext);

  console.log(chalk.gray('  Generating auth middleware...'));
  await generateAuthMiddleware(projectPath, framework, ext);

  // Password service (only if authMode needs password)
  if (needsPassword) {
    console.log(chalk.gray('  Generating password service...'));
    await generatePasswordService(projectPath, ext);
  }

  // Optional services based on options
  if (options.supabaseAdmin) {
    console.log(chalk.gray('  Generating Supabase admin service...'));
    await generateSupabaseAdminAuthService(projectPath, ext);
  }

  if (options.forgotPassword && needsPassword) {
    console.log(chalk.gray('  Generating forgot password service...'));
    await generateForgotPasswordService(projectPath, options, ext);
  }

  if (options.emailService) {
    console.log(chalk.gray('  Generating email service...'));
    await generateEmailService(projectPath, ext);
  }

  if (options.googleOAuth && needsOAuth) {
    console.log(chalk.gray('  Generating Google OAuth service...'));
    await generateGoogleOAuthService(projectPath, ext);
  }

  // Main auth components (always generated, adapted to authMode)
  console.log(chalk.gray('  Generating auth service...'));
  await generateAuthService(projectPath, options, ext);

  console.log(chalk.gray('  Generating auth controller...'));
  await generateAuthController(projectPath, options, framework, ext);

  console.log(chalk.gray('  Generating auth routes...'));
  await generateAuthRoutes(projectPath, options, framework, ext);

  // Schema generation (adapted to authMode)
  console.log(chalk.gray('  Generating auth schema...'));
  await generateAuthSchema(projectPath, authMode, ext);

  // Config updates
  console.log(chalk.gray('  Updating configuration...'));
  await generateAuthConfig(projectPath, options, ext);

  console.log(chalk.green('\n✅ Auth module generated successfully!'));
  
  // Print summary
  console.log(chalk.blue('\n📁 Generated files:'));
  console.log(chalk.gray('  src/auth/'));
  console.log(chalk.gray('    ├── jwks.service.' + ext));
  console.log(chalk.gray('    ├── jwt.service.' + ext));
  if (needsPassword) {
    console.log(chalk.gray('    ├── password.service.' + ext));
  }
  console.log(chalk.gray('    ├── auth.service.' + ext));
  console.log(chalk.gray('    ├── auth.controller.' + ext));
  console.log(chalk.gray('    ├── auth.routes.' + ext));
  if (options.supabaseAdmin) {
    console.log(chalk.gray('    ├── supabase-admin.service.' + ext));
  }
  if (options.forgotPassword && needsPassword) {
    console.log(chalk.gray('    ├── forgot-password.service.' + ext));
  }
  if (options.emailService) {
    console.log(chalk.gray('    ├── email.service.' + ext));
  }
  if (options.googleOAuth && needsOAuth) {
    console.log(chalk.gray('    ├── google-oauth.service.' + ext));
  }
  console.log(chalk.gray('  src/middleware/'));
  console.log(chalk.gray('    └── auth.middleware.' + ext));
  
  // Print auth mode specific info
  console.log(chalk.blue('\n🔐 Auth mode: ' + authMode));
  if (needsPassword) {
    console.log(chalk.gray('  Routes: POST /register, /login, PUT /change-password'));
  }
  if (options.googleOAuth && needsOAuth) {
    console.log(chalk.gray('  Routes: POST /google'));
  }
  console.log(chalk.gray('  Routes: POST /refresh, /logout, GET /me, /.well-known/jwks.json'));
  
  if (options.forgotPassword && needsPassword) {
    console.log(chalk.gray('  Routes: POST /forgot-password, /reset-password'));
  }
}

/**
 * Get project extension (ts or js) from package.json or tsconfig
 */
async function getProjectExtension(projectPath: string): Promise<string> {
  // Check for tsconfig.json
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (await fs.pathExists(tsconfigPath)) {
    return 'ts';
  }

  // Check package.json for type: module or typescript dependency
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        return 'ts';
      }
    } catch {
      // Ignore errors
    }
  }

  return 'js';
}
