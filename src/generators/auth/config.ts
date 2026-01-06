import fs from 'fs-extra';
import * as path from 'path';
import { AuthOptions } from './types.js';
import { updateAuthConfig } from '../../utils/config.js';

/**
 * Auth Config - Environment variables, gitignore updates, and nod.config.json tracking
 */
export async function generateAuthConfig(projectPath: string, options: AuthOptions, ext: string) {
  // Update nod.config.json with auth component settings
  try {
    await updateAuthConfig(projectPath, {
      supabaseAdmin: options.supabaseAdmin,
      customJwt: options.customJwt,
      jwks: options.jwks,
      forgotPassword: options.forgotPassword,
      googleOAuth: options.googleOAuth,
      emailService: options.emailService,
      authMode: options.authMode,
    });
  } catch {
    // Config file might not exist for older projects, that's ok
  }

  // Add to .env.example
  let envAdditions = `
# JWT Configuration
JWT_ISSUER=your-app-name
JWT_AUDIENCE=your-api
`;

  if (options.supabaseAdmin) {
    envAdditions += `
# Supabase Admin (for creating users when signups disabled)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
`;
  }

  if (options.googleOAuth) {
    envAdditions += `
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
`;
  }

  if (options.emailService) {
    envAdditions += `
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourapp.com
APP_URL=http://localhost:3000
`;
  }

  const envExamplePath = path.join(projectPath, '.env.example');

  try {
    let existingEnv = '';
    if (await fs.pathExists(envExamplePath)) {
      existingEnv = await fs.readFile(envExamplePath, 'utf-8');
    }

    // Only add if not already present
    if (!existingEnv.includes('JWT_ISSUER')) {
      await fs.appendFile(envExamplePath, envAdditions);
    }
  } catch {
    await fs.outputFile(envExamplePath, envAdditions.trim());
  }

  // Add .keys to .gitignore
  const gitignorePath = path.join(projectPath, '.gitignore');

  try {
    let existingGitignore = '';
    if (await fs.pathExists(gitignorePath)) {
      existingGitignore = await fs.readFile(gitignorePath, 'utf-8');
    }

    const additions: string[] = [];

    if (!existingGitignore.includes('.keys')) {
      additions.push('# Auth keys');
      additions.push('.keys/');
    }

    if (additions.length > 0) {
      await fs.appendFile(gitignorePath, '\n' + additions.join('\n') + '\n');
    }
  } catch {
    await fs.outputFile(gitignorePath, '# Auth keys\n.keys/\n');
  }
}
