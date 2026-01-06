import fs from 'fs-extra';
import * as path from 'path';

/**
 * JWKS Service - Auto-generates RSA key pair on first run
 * Exposes /.well-known/jwks.json endpoint
 */
export async function generateJWKSService(projectPath: string, ext: string) {
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
