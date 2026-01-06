import fs from 'fs-extra';
import path from 'path';

/**
 * JWT Service - Sign and verify JWTs using custom keys
 */
export async function generateJWTService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { getPrivateKey, getPublicKey, getKeyId } from './jwks.service.js';
import config from '../config/config.js';

export interface TokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  type?: 'access' | 'refresh' | 'reset';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const RESET_TOKEN_EXPIRY = '1h';

/**
 * Sign a new access token
 */
export async function signAccessToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  const privateKey = getPrivateKey();

  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setAudience(config.jwtAudience || 'api')
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Sign a new refresh token
 */
export async function signRefreshToken(userId: string): Promise<string> {
  const privateKey = getPrivateKey();

  return new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Sign a password reset token
 */
export async function signResetToken(userId: string, email: string): Promise<string> {
  const privateKey = getPrivateKey();

  return new SignJWT({ sub: userId, email, type: 'reset' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setExpirationTime(RESET_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Generate access and refresh token pair
 */
export async function generateTokenPair(payload: Omit<TokenPayload, 'type'>): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload.sub)
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900 // 15 minutes in seconds
  };
}

/**
 * Verify any token and return payload
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const publicKey = getPublicKey();

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: config.jwtIssuer || 'auth-service'
  });

  return payload as TokenPayload;
}

/**
 * Verify specifically an access token
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const payload = await verifyToken(token);

  if (payload.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }

  return payload;
}

/**
 * Verify specifically a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const payload = await verifyToken(token);

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }

  return payload;
}

/**
 * Verify specifically a reset token
 */
export async function verifyResetToken(token: string): Promise<TokenPayload> {
  const payload = await verifyToken(token);

  if (payload.type !== 'reset') {
    throw new Error('Invalid token type: expected reset token');
  }

  return payload;
}

export default {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  generateTokenPair,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken
};
`
    : `import { SignJWT, jwtVerify } from 'jose';
import { getPrivateKey, getPublicKey, getKeyId } from './jwks.service.js';
import config from '../config/config.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const RESET_TOKEN_EXPIRY = '1h';

/**
 * Sign a new access token
 */
export async function signAccessToken(payload) {
  const privateKey = getPrivateKey();

  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setAudience(config.jwtAudience || 'api')
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Sign a new refresh token
 */
export async function signRefreshToken(userId) {
  const privateKey = getPrivateKey();

  return new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Sign a password reset token
 */
export async function signResetToken(userId, email) {
  const privateKey = getPrivateKey();

  return new SignJWT({ sub: userId, email, type: 'reset' })
    .setProtectedHeader({ alg: 'RS256', kid: getKeyId() })
    .setIssuedAt()
    .setIssuer(config.jwtIssuer || 'auth-service')
    .setExpirationTime(RESET_TOKEN_EXPIRY)
    .sign(privateKey);
}

/**
 * Generate access and refresh token pair
 */
export async function generateTokenPair(payload) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload.sub)
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900 // 15 minutes in seconds
  };
}

/**
 * Verify any token and return payload
 */
export async function verifyToken(token) {
  const publicKey = getPublicKey();

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: config.jwtIssuer || 'auth-service'
  });

  return payload;
}

/**
 * Verify specifically an access token
 */
export async function verifyAccessToken(token) {
  const payload = await verifyToken(token);

  if (payload.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }

  return payload;
}

/**
 * Verify specifically a refresh token
 */
export async function verifyRefreshToken(token) {
  const payload = await verifyToken(token);

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }

  return payload;
}

/**
 * Verify specifically a reset token
 */
export async function verifyResetToken(token) {
  const payload = await verifyToken(token);

  if (payload.type !== 'reset') {
    throw new Error('Invalid token type: expected reset token');
  }

  return payload;
}

export default {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  generateTokenPair,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/jwt.service.${ext}`), content);
}
