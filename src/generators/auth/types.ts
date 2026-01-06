import { AuthMode } from '../../types/index.js';

export interface AuthOptions {
  supabaseAdmin: boolean;
  customJwt: boolean;
  jwks: boolean;
  forgotPassword: boolean;
  googleOAuth: boolean;
  emailService: boolean;
  authMode: AuthMode;
  framework: 'express' | 'hono';
}
