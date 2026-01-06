import * as fs from 'fs-extra';
import * as path from 'path';
import { getProjectConfig, updateAuthConfig } from '../utils/config.js';
import { AuthMode } from '../types/index.js';

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

/**
 * Main auth generator - generates complete auth module
 * 
 * Adapts based on authMode:
 * - 'email-password': Traditional email/password auth only
 * - 'oauth-only': Only OAuth providers (Google, etc.), no password service
 * - 'both': Email/password + OAuth
 */
export async function generateAuth(projectPath: string, options: AuthOptions, ext: string) {
  const isTS = ext === 'ts';
  const { framework, authMode } = options;
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

  // Generate core auth services
  await generateJWKSService(projectPath, ext);
  await generateJWTService(projectPath, ext);
  
  // Only generate password service if email-password or both mode
  if (needsPassword) {
    await generatePasswordService(projectPath, ext);
  }
  
  await generateAuthMiddleware(projectPath, framework, ext);

  // Generate optional services based on options
  if (options.supabaseAdmin) {
    await generateSupabaseAdminAuthService(projectPath, ext);
  }

  // Forgot password only makes sense with email-password mode
  if (options.forgotPassword && needsPassword) {
    await generateForgotPasswordService(projectPath, options, ext);
  }

  // Google OAuth only if oauth-only or both mode, and explicitly enabled
  if (options.googleOAuth && needsOAuth) {
    await generateGoogleOAuthService(projectPath, ext);
  }

  // Email service for password reset emails (only if password mode)
  if (options.emailService && needsPassword) {
    await generateEmailService(projectPath, ext);
  }

  // Generate routes, controller, and main service
  await generateAuthService(projectPath, options, ext);
  await generateAuthController(projectPath, options, framework, ext);
  await generateAuthRoutes(projectPath, options, framework, ext);

  // Generate database schema based on project config and authMode
  await generateAuthSchema(projectPath, options, ext);

  // Generate config additions
  await generateAuthConfig(projectPath, options, ext);
}

/**
 * JWKS Service - Auto-generates RSA key pair on first run
 * Exposes /.well-known/jwks.json endpoint
 */
async function generateJWKSService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exportJWK, importPKCS8, importSPKI, KeyLike } from 'jose';
import logger from '../utils/logger.js';

const KEYS_DIR = path.join(process.cwd(), '.keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');
const KEY_ID = 'auth-key-1';

interface JWKSResponse {
  keys: Array<{
    kty: string;
    use: string;
    kid: string;
    alg: string;
    n?: string;
    e?: string;
  }>;
}

let privateKey: KeyLike | null = null;
let publicKey: KeyLike | null = null;
let jwksCache: JWKSResponse | null = null;

/**
 * Initialize JWKS - generates keys on first run, loads from disk on subsequent runs
 */
export async function initializeJWKS(): Promise<void> {
  try {
    // Ensure keys directory exists
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
      logger.info('Created .keys directory');
    }

    // Check if keys exist
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
      logger.info('Loading existing RSA keys...');
      await loadKeys();
    } else {
      logger.info('Generating new RSA key pair...');
      await generateKeyPair();
    }

    // Build JWKS cache
    await buildJWKSCache();
    logger.info('JWKS initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize JWKS:', error);
    throw error;
  }
}

/**
 * Generate new RSA key pair and save to disk
 */
async function generateKeyPair(): Promise<void> {
  const { privateKey: privKey, publicKey: pubKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Save keys to disk
  fs.writeFileSync(PRIVATE_KEY_PATH, privKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, pubKey);

  // Set restrictive permissions on private key (Unix only)
  try {
    fs.chmodSync(PRIVATE_KEY_PATH, 0o600);
  } catch {
    // Windows doesn't support chmod
  }

  logger.info('RSA key pair generated and saved');

  // Load the keys into memory
  await loadKeys();
}

/**
 * Load keys from disk into memory
 */
async function loadKeys(): Promise<void> {
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');

  privateKey = await importPKCS8(privateKeyPem, 'RS256');
  publicKey = await importSPKI(publicKeyPem, 'RS256');
}

/**
 * Build JWKS response and cache it
 */
async function buildJWKSCache(): Promise<void> {
  if (!publicKey) {
    throw new Error('Public key not loaded');
  }

  const jwk = await exportJWK(publicKey);

  jwksCache = {
    keys: [
      {
        ...jwk,
        use: 'sig',
        kid: KEY_ID,
        alg: 'RS256'
      }
    ]
  };
}

/**
 * Get the private key for signing JWTs
 */
export function getPrivateKey(): KeyLike {
  if (!privateKey) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return privateKey;
}

/**
 * Get the public key for verifying JWTs
 */
export function getPublicKey(): KeyLike {
  if (!publicKey) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return publicKey;
}

/**
 * Get the key ID used in JWT headers
 */
export function getKeyId(): string {
  return KEY_ID;
}

/**
 * Get the JWKS response for the /.well-known/jwks.json endpoint
 */
export function getJWKS(): JWKSResponse {
  if (!jwksCache) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return jwksCache;
}

export default {
  initializeJWKS,
  getPrivateKey,
  getPublicKey,
  getKeyId,
  getJWKS
};
`
    : `import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exportJWK, importPKCS8, importSPKI } from 'jose';
import logger from '../utils/logger.js';

const KEYS_DIR = path.join(process.cwd(), '.keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');
const KEY_ID = 'auth-key-1';

let privateKey = null;
let publicKey = null;
let jwksCache = null;

/**
 * Initialize JWKS - generates keys on first run, loads from disk on subsequent runs
 */
export async function initializeJWKS() {
  try {
    // Ensure keys directory exists
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
      logger.info('Created .keys directory');
    }

    // Check if keys exist
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
      logger.info('Loading existing RSA keys...');
      await loadKeys();
    } else {
      logger.info('Generating new RSA key pair...');
      await generateKeyPair();
    }

    // Build JWKS cache
    await buildJWKSCache();
    logger.info('JWKS initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize JWKS:', error);
    throw error;
  }
}

/**
 * Generate new RSA key pair and save to disk
 */
async function generateKeyPair() {
  const { privateKey: privKey, publicKey: pubKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Save keys to disk
  fs.writeFileSync(PRIVATE_KEY_PATH, privKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, pubKey);

  // Set restrictive permissions on private key (Unix only)
  try {
    fs.chmodSync(PRIVATE_KEY_PATH, 0o600);
  } catch {
    // Windows doesn't support chmod
  }

  logger.info('RSA key pair generated and saved');

  // Load the keys into memory
  await loadKeys();
}

/**
 * Load keys from disk into memory
 */
async function loadKeys() {
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');

  privateKey = await importPKCS8(privateKeyPem, 'RS256');
  publicKey = await importSPKI(publicKeyPem, 'RS256');
}

/**
 * Build JWKS response and cache it
 */
async function buildJWKSCache() {
  if (!publicKey) {
    throw new Error('Public key not loaded');
  }

  const jwk = await exportJWK(publicKey);

  jwksCache = {
    keys: [
      {
        ...jwk,
        use: 'sig',
        kid: KEY_ID,
        alg: 'RS256'
      }
    ]
  };
}

/**
 * Get the private key for signing JWTs
 */
export function getPrivateKey() {
  if (!privateKey) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return privateKey;
}

/**
 * Get the public key for verifying JWTs
 */
export function getPublicKey() {
  if (!publicKey) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return publicKey;
}

/**
 * Get the key ID used in JWT headers
 */
export function getKeyId() {
  return KEY_ID;
}

/**
 * Get the JWKS response for the /.well-known/jwks.json endpoint
 */
export function getJWKS() {
  if (!jwksCache) {
    throw new Error('JWKS not initialized. Call initializeJWKS() first.');
  }
  return jwksCache;
}

export default {
  initializeJWKS,
  getPrivateKey,
  getPublicKey,
  getKeyId,
  getJWKS
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/jwks.service.${ext}`), content);
}

/**
 * JWT Service - Sign and verify JWTs using custom keys
 */
async function generateJWTService(projectPath: string, ext: string) {
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

/**
 * Password Service - Hash and verify passwords using bcrypt
 */
async function generatePasswordService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a password meets minimum requirements
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  hashPassword,
  verifyPassword,
  validatePasswordStrength
};
`
    : `import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a password meets minimum requirements
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  hashPassword,
  verifyPassword,
  validatePasswordStrength
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/password.service.${ext}`), content);
}

/**
 * Auth Middleware - Verify JWT from Authorization header
 */
async function generateAuthMiddleware(projectPath: string, framework: 'express' | 'hono', ext: string) {
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

/**
 * Supabase Admin Auth Service - Create users when signups are disabled
 */
async function generateSupabaseAdminAuthService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let adminClient: SupabaseClient | null = null;

/**
 * Get Supabase admin client (uses service role key)
 */
function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required for admin operations');
    }

    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
  role?: string;
  emailConfirm?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at?: string;
  user_metadata: Record<string, unknown>;
}

/**
 * Create a new user via Supabase Admin API
 * Use this when signups are disabled in Supabase dashboard
 */
export async function createUser(data: CreateUserData): Promise<AdminUser> {
  const client = getAdminClient();

  const { data: userData, error } = await client.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: data.emailConfirm ?? true,
    user_metadata: {
      name: data.name,
      role: data.role || 'user'
    }
  });

  if (error) {
    logger.error('Failed to create user:', error.message);
    throw new Error(\`Failed to create user: \${error.message}\`);
  }

  logger.info(\`User created: \${userData.user.email}\`);

  return {
    id: userData.user.id,
    email: userData.user.email!,
    created_at: userData.user.created_at,
    email_confirmed_at: userData.user.email_confirmed_at,
    user_metadata: userData.user.user_metadata
  };
}

/**
 * Delete a user via Supabase Admin API
 */
export async function deleteUser(userId: string): Promise<void> {
  const client = getAdminClient();

  const { error } = await client.auth.admin.deleteUser(userId);

  if (error) {
    logger.error('Failed to delete user:', error.message);
    throw new Error(\`Failed to delete user: \${error.message}\`);
  }

  logger.info(\`User deleted: \${userId}\`);
}

/**
 * List all users via Supabase Admin API
 */
export async function listUsers(page = 1, perPage = 50): Promise<AdminUser[]> {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage
  });

  if (error) {
    logger.error('Failed to list users:', error.message);
    throw new Error(\`Failed to list users: \${error.message}\`);
  }

  return data.users.map(user => ({
    id: user.id,
    email: user.email!,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata
  }));
}

/**
 * Get user by ID via Supabase Admin API
 */
export async function getUserById(userId: string): Promise<AdminUser | null> {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error) {
    if (error.message.includes('not found')) {
      return null;
    }
    logger.error('Failed to get user:', error.message);
    throw new Error(\`Failed to get user: \${error.message}\`);
  }

  return {
    id: data.user.id,
    email: data.user.email!,
    created_at: data.user.created_at,
    email_confirmed_at: data.user.email_confirmed_at,
    user_metadata: data.user.user_metadata
  };
}

export default {
  createUser,
  deleteUser,
  listUsers,
  getUserById
};
`
    : `import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let adminClient = null;

/**
 * Get Supabase admin client (uses service role key)
 */
function getAdminClient() {
  if (!adminClient) {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required for admin operations');
    }

    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

/**
 * Create a new user via Supabase Admin API
 * Use this when signups are disabled in Supabase dashboard
 */
export async function createUser(data) {
  const client = getAdminClient();

  const { data: userData, error } = await client.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: data.emailConfirm ?? true,
    user_metadata: {
      name: data.name,
      role: data.role || 'user'
    }
  });

  if (error) {
    logger.error('Failed to create user:', error.message);
    throw new Error(\`Failed to create user: \${error.message}\`);
  }

  logger.info(\`User created: \${userData.user.email}\`);

  return {
    id: userData.user.id,
    email: userData.user.email,
    created_at: userData.user.created_at,
    email_confirmed_at: userData.user.email_confirmed_at,
    user_metadata: userData.user.user_metadata
  };
}

/**
 * Delete a user via Supabase Admin API
 */
export async function deleteUser(userId) {
  const client = getAdminClient();

  const { error } = await client.auth.admin.deleteUser(userId);

  if (error) {
    logger.error('Failed to delete user:', error.message);
    throw new Error(\`Failed to delete user: \${error.message}\`);
  }

  logger.info(\`User deleted: \${userId}\`);
}

/**
 * List all users via Supabase Admin API
 */
export async function listUsers(page = 1, perPage = 50) {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage
  });

  if (error) {
    logger.error('Failed to list users:', error.message);
    throw new Error(\`Failed to list users: \${error.message}\`);
  }

  return data.users.map(user => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata
  }));
}

/**
 * Get user by ID via Supabase Admin API
 */
export async function getUserById(userId) {
  const client = getAdminClient();

  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error) {
    if (error.message.includes('not found')) {
      return null;
    }
    logger.error('Failed to get user:', error.message);
    throw new Error(\`Failed to get user: \${error.message}\`);
  }

  return {
    id: data.user.id,
    email: data.user.email,
    created_at: data.user.created_at,
    email_confirmed_at: data.user.email_confirmed_at,
    user_metadata: data.user.user_metadata
  };
}

export default {
  createUser,
  deleteUser,
  listUsers,
  getUserById
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/supabase-admin.service.${ext}`), content);
}

/**
 * Forgot Password Service - Password reset flow
 */
async function generateForgotPasswordService(projectPath: string, options: AuthOptions, ext: string) {
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

/**
 * Email Service - Nodemailer with templates
 */
async function generateEmailService(projectPath: string, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface TransporterConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const transporterConfig: TransporterConfig = {
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser || '',
        pass: config.smtpPassword || ''
      }
    };

    transporter = nodemailer.createTransport(transporterConfig);
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();

  const mailOptions = {
    from: config.smtpFrom || config.smtpUser,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  };

  try {
    await transport.sendMail(mailOptions);
    logger.info(\`Email sent to \${options.to}\`);
  } catch (error: any) {
    logger.error(\`Failed to send email to \${options.to}:\`, error.message);
    throw new Error(\`Failed to send email: \${error.message}\`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = \`\${config.appUrl}/reset-password?token=\${resetToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Reset Your Password</h1>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="\${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </body>
    </html>
  \`;

  const text = \`Reset Your Password\\n\\nYou requested a password reset. Visit the following link to reset your password:\\n\\n\${resetUrl}\\n\\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.\`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<void> {
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome!</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Welcome\${name ? \`, \${name}\` : ''}!</h1>
      <p>Thank you for signing up. We're excited to have you on board.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p style="color: #999; font-size: 12px;">Best regards,<br>The Team</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Welcome!',
    html
  });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
  const verifyUrl = \`\${config.appUrl}/verify-email?token=\${verificationToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Verify Your Email</h1>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="\${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${verifyUrl}</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html
  });
}

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail
};
`
    : `import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let transporter = null;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (!transporter) {
    const transporterConfig = {
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser || '',
        pass: config.smtpPassword || ''
      }
    };

    transporter = nodemailer.createTransport(transporterConfig);
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options) {
  const transport = getTransporter();

  const mailOptions = {
    from: config.smtpFrom || config.smtpUser,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  };

  try {
    await transport.sendMail(mailOptions);
    logger.info(\`Email sent to \${options.to}\`);
  } catch (error) {
    logger.error(\`Failed to send email to \${options.to}:\`, error.message);
    throw new Error(\`Failed to send email: \${error.message}\`);
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = \`\${config.appUrl}/reset-password?token=\${resetToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Reset Your Password</h1>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <a href="\${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </body>
    </html>
  \`;

  const text = \`Reset Your Password\\n\\nYou requested a password reset. Visit the following link to reset your password:\\n\\n\${resetUrl}\\n\\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.\`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email, name) {
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome!</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Welcome\${name ? \`, \${name}\` : ''}!</h1>
      <p>Thank you for signing up. We're excited to have you on board.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p style="color: #999; font-size: 12px;">Best regards,<br>The Team</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Welcome!',
    html
  });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email, verificationToken) {
  const verifyUrl = \`\${config.appUrl}/verify-email?token=\${verificationToken}\`;

  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Verify Your Email</h1>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="\${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">\${verifyUrl}</p>
    </body>
    </html>
  \`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html
  });
}

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/email.service.${ext}`), content);
}

/**
 * Google OAuth Service - Verify Google ID tokens
 */
async function generateGoogleOAuthService(projectPath: string, ext: string) {
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

/**
 * Main Auth Service - Orchestrates all auth operations
 */
async function generateAuthService(projectPath: string, options: AuthOptions, ext: string) {
  const isTS = ext === 'ts';

  const content = isTS
    ? `import { generateTokenPair, verifyRefreshToken, TokenPair } from './jwt.service.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password.service.js';
${options.emailService ? `import { sendWelcomeEmail } from './email.service.js';` : ''}
import logger from '../utils/logger.js';

export interface RegisterData {
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
  password_hash: string;
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

export default {
  register,
  login,
  changePassword,
  refreshToken,
  logout
};
`
    : `import { generateTokenPair, verifyRefreshToken } from './jwt.service.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password.service.js';
${options.emailService ? `import { sendWelcomeEmail } from './email.service.js';` : ''}
import logger from '../utils/logger.js';

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

export default {
  register,
  login,
  changePassword,
  refreshToken,
  logout
};
`;

  await fs.outputFile(path.join(projectPath, `src/auth/auth.service.${ext}`), content);
}

/**
 * Auth Controller - Route handlers
 */
async function generateAuthController(projectPath: string, options: AuthOptions, framework: 'express' | 'hono', ext: string) {
  const isTS = ext === 'ts';

  const expressContent = isTS
    ? `import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import authService from './auth.service.js';
${options.forgotPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

/**
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

${options.forgotPassword ? `/**
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

${options.googleOAuth ? `/**
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

    const googleUser = await verifyGoogleToken(idToken);

    // TODO: Find or create user in database based on googleUser.email
    // const user = await findOrCreateUser(googleUser);

    // TODO: Generate tokens for the user
    // const tokens = await generateTokenPair({ sub: user.id, email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      googleUser
      // user,
      // tokens
    });
  } catch (error: any) {
    logger.error('Google auth controller error:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Google authentication failed'
    });
  }
};` : ''}

export default {
  register,
  login,
  changePassword,
  refresh,
  logout,
  me${options.forgotPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth ? `,
  googleAuth` : ''}
};
`
    : `import authService from './auth.service.js';
${options.forgotPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

/**
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

${options.forgotPassword ? `/**
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

    // TODO: Implement updatePasswordFn to update password in database
    const result = await resetPassword(token, newPassword, async (userId, hashedPassword) => {
      // await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
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

${options.googleOAuth ? `/**
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

    // TODO: Find or create user in database based on googleUser.email
    // const user = await findOrCreateUser(googleUser);

    // TODO: Generate tokens for the user
    // const tokens = await generateTokenPair({ sub: user.id, email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      googleUser
      // user,
      // tokens
    });
  } catch (error) {
    logger.error('Google auth controller error:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Google authentication failed'
    });
  }
};` : ''}

export default {
  register,
  login,
  changePassword,
  refresh,
  logout,
  me${options.forgotPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth ? `,
  googleAuth` : ''}
};
`;

  const honoContent = isTS
    ? `import { Context } from 'hono';
import authService from './auth.service.js';
${options.forgotPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

/**
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

${options.forgotPassword ? `/**
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

    // TODO: Look up user by email and get their ID
    // For security, always return success even if user not found

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

${options.googleOAuth ? `/**
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

    return c.json({
      success: true,
      message: 'Google authentication successful',
      googleUser
    }, 200);
  } catch (error: any) {
    logger.error('Google auth controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Google authentication failed'
    }, 401);
  }
};` : ''}

export default {
  register,
  login,
  changePassword,
  refresh,
  logout,
  me${options.forgotPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth ? `,
  googleAuth` : ''}
};
`
    : `import authService from './auth.service.js';
${options.forgotPassword ? `import { initiateForgotPassword, resetPassword } from './forgot-password.service.js';` : ''}
${options.googleOAuth ? `import { verifyGoogleToken } from './google-oauth.service.js';` : ''}
import logger from '../utils/logger.js';

/**
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

${options.forgotPassword ? `/**
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

${options.googleOAuth ? `/**
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

    return c.json({
      success: true,
      message: 'Google authentication successful',
      googleUser
    }, 200);
  } catch (error) {
    logger.error('Google auth controller error:', error.message);
    return c.json({
      success: false,
      message: error.message || 'Google authentication failed'
    }, 401);
  }
};` : ''}

export default {
  register,
  login,
  changePassword,
  refresh,
  logout,
  me${options.forgotPassword ? `,
  forgotPassword,
  resetPassword: resetPasswordHandler` : ''}${options.googleOAuth ? `,
  googleAuth` : ''}
};
`;

  const content = framework === 'hono' ? honoContent : expressContent;
  await fs.outputFile(path.join(projectPath, `src/auth/auth.controller.${ext}`), content);
}

/**
 * Auth Routes - Route definitions
 */
async function generateAuthRoutes(projectPath: string, options: AuthOptions, framework: 'express' | 'hono', ext: string) {
  const isTS = ext === 'ts';

  const expressContent = isTS
    ? `import { Router } from 'express';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// JWKS endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

${options.forgotPassword ? `// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);` : ''}

${options.googleOAuth ? `// OAuth routes
router.post('/google', authController.googleAuth);` : ''}

// Protected routes
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);
router.put('/change-password', authMiddleware, authController.changePassword);

export default router;
`
    : `import { Router } from 'express';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// JWKS endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

${options.forgotPassword ? `// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);` : ''}

${options.googleOAuth ? `// OAuth routes
router.post('/google', authController.googleAuth);` : ''}

// Protected routes
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);
router.put('/change-password', authMiddleware, authController.changePassword);

export default router;
`;

  const honoContent = isTS
    ? `import { Hono } from 'hono';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const auth = new Hono();

// Public routes
auth.post('/register', authController.register);
auth.post('/login', authController.login);
auth.post('/refresh', authController.refresh);

// JWKS endpoint
auth.get('/.well-known/jwks.json', (c) => c.json(getJWKS()));

${options.forgotPassword ? `// Password reset routes
auth.post('/forgot-password', authController.forgotPassword);
auth.post('/reset-password', authController.resetPassword);` : ''}

${options.googleOAuth ? `// OAuth routes
auth.post('/google', authController.googleAuth);` : ''}

// Protected routes
auth.get('/me', authMiddleware, authController.me);
auth.post('/logout', authMiddleware, authController.logout);
auth.put('/change-password', authMiddleware, authController.changePassword);

export default auth;
`
    : `import { Hono } from 'hono';
import authController from './auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { getJWKS } from './jwks.service.js';

const auth = new Hono();

// Public routes
auth.post('/register', authController.register);
auth.post('/login', authController.login);
auth.post('/refresh', authController.refresh);

// JWKS endpoint
auth.get('/.well-known/jwks.json', (c) => c.json(getJWKS()));

${options.forgotPassword ? `// Password reset routes
auth.post('/forgot-password', authController.forgotPassword);
auth.post('/reset-password', authController.resetPassword);` : ''}

${options.googleOAuth ? `// OAuth routes
auth.post('/google', authController.googleAuth);` : ''}

// Protected routes
auth.get('/me', authMiddleware, authController.me);
auth.post('/logout', authMiddleware, authController.logout);
auth.put('/change-password', authMiddleware, authController.changePassword);

export default auth;
`;

  const content = framework === 'hono' ? honoContent : expressContent;
  await fs.outputFile(path.join(projectPath, `src/auth/auth.routes.${ext}`), content);
}

/**
 * Auth Config - Environment variables, gitignore updates, and nod.config.json tracking
 */
async function generateAuthConfig(projectPath: string, options: AuthOptions, ext: string) {
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

/**
 * Generate auth database schema based on project ORM configuration and authMode
 * 
 * For Supabase: No schema needed - uses built-in auth.users table
 * For other databases: Users table adapted based on authMode:
 *   - email-password: includes passwordHash, no googleId
 *   - oauth-only: no passwordHash, includes googleId
 *   - both: includes both passwordHash and googleId
 */
async function generateAuthSchema(projectPath: string, options: AuthOptions, ext: string) {
  const config = await getProjectConfig(projectPath);
  
  const orm = config?.orm || 'raw';
  const database = config?.database || 'pg';
  const { authMode } = options;
  
  // For Supabase, skip schema generation entirely
  // Supabase handles users table and password hashing internally
  if (database === 'supabase') {
    // No schema generation needed - Supabase auth.users handles everything
    return;
  }
  
  if (orm === 'drizzle') {
    await generateDrizzleAuthSchema(projectPath, authMode, ext);
  } else {
    await generateSqlAuthSchema(projectPath, database, authMode);
  }
}

/**
 * Generate Drizzle ORM schema for auth tables
 * 
 * Adapts based on authMode:
 * - email-password: includes passwordHash, no googleId
 * - oauth-only: no passwordHash, includes googleId  
 * - both: includes both passwordHash and googleId
 */
async function generateDrizzleAuthSchema(projectPath: string, authMode: AuthMode, ext: string) {
  const isTS = ext === 'ts';
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';
  
  // Build fields based on authMode
  const passwordField = needsPassword ? `  passwordHash: text('password_hash'),${needsPassword && authMode === 'email-password' ? ' // bcrypt hash' : ' // bcrypt hash, null for OAuth-only users'}` : '';
  const googleIdField = needsOAuth ? `  googleId: varchar('google_id', { length: 255 }).unique(),${authMode === 'oauth-only' ? ' // Required for OAuth-only' : ' // For Google OAuth linking'}` : '';
  
  const content = isTS
    ? `import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Users table - stores user account and profile information
 * 
 * Auth Mode: ${authMode}
 * JWT tokens are stateless - no sessions table required
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
${passwordField ? passwordField + '\n' : ''}  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
${googleIdField ? googleIdField + '\n' : ''}  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`
    : `import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Users table - stores user account and profile information
 * Auth Mode: ${authMode}
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
${passwordField ? passwordField + '\n' : ''}  name: varchar('name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
${googleIdField ? googleIdField + '\n' : ''}  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
`;

  await fs.outputFile(path.join(projectPath, `src/db/schema/auth.${ext}`), content);
}

/**
 * Generate raw SQL schema for auth tables
 * 
 * Adapts based on authMode:
 * - email-password: includes password_hash, no google_id
 * - oauth-only: no password_hash, includes google_id
 * - both: includes both
 */
async function generateSqlAuthSchema(projectPath: string, database: string, authMode: AuthMode) {
  const isMySQL = database === 'mysql';
  const needsPassword = authMode === 'email-password' || authMode === 'both';
  const needsOAuth = authMode === 'oauth-only' || authMode === 'both';
  
  // Build field lines
  const passwordField = needsPassword ? `  password_hash TEXT,${authMode === 'email-password' ? ' -- bcrypt hash' : ' -- bcrypt hash, null for OAuth-only users'}` : '';
  const googleIdField = needsOAuth ? `  google_id VARCHAR(255) UNIQUE,${authMode === 'oauth-only' ? ' -- Required for OAuth' : ' -- For Google OAuth linking'}` : '';
  const googleIdIndex = needsOAuth ? (isMySQL ? `  INDEX idx_users_google_id (google_id)` : `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`) : '';
  
  const content = isMySQL
    ? `-- Auth Schema for MySQL
-- Auth Mode: ${authMode}
-- Run this in your MySQL database

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
${passwordField ? passwordField + '\n' : ''}  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
${googleIdField ? googleIdField + '\n' : ''}  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)${needsOAuth ? ',\n' + googleIdIndex : ''}
);
`
    : `-- Auth Schema for PostgreSQL
-- Auth Mode: ${authMode}
-- Run this in your PostgreSQL database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
${passwordField ? passwordField + '\n' : ''}  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
${googleIdField ? googleIdField + '\n' : ''}  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
${googleIdIndex}

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

  // Ensure sql directory exists
  await fs.ensureDir(path.join(projectPath, 'sql'));
  await fs.outputFile(path.join(projectPath, 'sql/auth-schema.sql'), content);
}
