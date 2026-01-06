import fs from 'fs-extra';
import * as path from 'path';

/**
 * Google OAuth Service - Verify Google ID tokens
 */
export async function generateGoogleOAuthService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { OAuth2Client } from 'google-auth-library';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let oauthClient: OAuth2Client | null = null;

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}

/**
 * Get Google OAuth client
 */
function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    if (!config.googleClientId) {
      throw new Error('Google Client ID is required for OAuth');
    }
    oauthClient = new OAuth2Client(config.googleClientId);
  }
  return oauthClient;
}

/**
 * Verify Google ID token and extract user info
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  const client = getOAuthClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: payload.email!,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified ?? false
    };
  } catch (error: any) {
    logger.error('Google token verification failed:', error.message);
    throw new Error('Invalid Google token');
  }
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(redirectUri: string, state?: string): string {
  const client = getOAuthClient();

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    redirect_uri: redirectUri,
    state
  });

  return url;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ idToken: string; accessToken: string; refreshToken?: string }> {
  const client = getOAuthClient();

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectUri
    });

    if (!tokens.id_token || !tokens.access_token) {
      throw new Error('Failed to get tokens from Google');
    }

    return {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined
    };
  } catch (error: any) {
    logger.error('Failed to exchange code for tokens:', error.message);
    throw new Error('Failed to authenticate with Google');
  }
}

export default {
  verifyGoogleToken,
  getAuthorizationUrl,
  exchangeCodeForTokens
};
`
    : `import { OAuth2Client } from 'google-auth-library';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let oauthClient = null;

/**
 * Get Google OAuth client
 */
function getOAuthClient() {
  if (!oauthClient) {
    if (!config.googleClientId) {
      throw new Error('Google Client ID is required for OAuth');
    }
    oauthClient = new OAuth2Client(config.googleClientId);
  }
  return oauthClient;
}

/**
 * Verify Google ID token and extract user info
 */
export async function verifyGoogleToken(idToken) {
  const client = getOAuthClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified ?? false
    };
  } catch (error) {
    logger.error('Google token verification failed:', error.message);
    throw new Error('Invalid Google token');
  }
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(redirectUri, state) {
  const client = getOAuthClient();

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    redirect_uri: redirectUri,
    state
  });

  return url;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code, redirectUri) {
  const client = getOAuthClient();

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectUri
    });

    if (!tokens.id_token || !tokens.access_token) {
      throw new Error('Failed to get tokens from Google');
    }

    return {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined
    };
  } catch (error) {
    logger.error('Failed to exchange code for tokens:', error.message);
    throw new Error('Failed to authenticate with Google');
  }
}

export default {
  verifyGoogleToken,
  getAuthorizationUrl,
  exchangeCodeForTokens
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/google-oauth.service.${ext}`), content);
}
