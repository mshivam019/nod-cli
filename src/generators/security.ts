import fs from 'fs-extra';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { ProjectConfig } from '../types/index.js';

export async function generateStrictSecurity(projectPath: string, config: ProjectConfig, ext: string) {
  if (config.framework !== 'express') {
    return;
  }

  await fs.ensureDir(path.join(projectPath, 'src/config'));
  await fs.ensureDir(path.join(projectPath, 'src/middleware'));
  await fs.ensureDir(path.join(projectPath, 'src/helpers'));

  await generateTrustedOrigins(projectPath, ext);
  await generateRequestLimits(projectPath, ext);
  await generateCorsMiddleware(projectPath, ext);
  await generateOriginVerifyMiddleware(projectPath, ext);
  await generateRequestSizeMiddleware(projectPath, ext);
  await generateCsrfMiddleware(projectPath, ext);

  if (config.auth === 'cookie-session') {
    await generateCookieSession(projectPath, ext);
  }

  if (config.auth === 'better-auth') {
    await generateBetterAuth(projectPath, ext);
  }
}

async function generateTrustedOrigins(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const content = `${isTS ? "type NodeEnv = 'development' | 'staging' | 'production' | 'test';\n\n" : ''}const parseCsv = (value${isTS ? ': string | undefined' : ''})${isTS ? ': string[]' : ''} =>
  (value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

export const trustedParentDomains = parseCsv(process.env.TRUSTED_PARENT_DOMAINS || 'localhost');

export const localhostOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

export const allowLocalhostForEnv = (nodeEnv${isTS ? ': NodeEnv | string' : ''})${isTS ? ': boolean' : ''} =>
  nodeEnv === 'development' || nodeEnv === 'test';

export const isTrustedParentHostname = (hostname${isTS ? ': string' : ''})${isTS ? ': boolean' : ''} => {
  const normalized = hostname.toLowerCase();

  return trustedParentDomains.some(domain =>
    normalized === domain || normalized.endsWith(\`.\${domain}\`)
  );
};

export const isAllowedCorsHostname = (hostname${isTS ? ': string' : ''}, nodeEnv${isTS ? ': NodeEnv | string' : ''})${isTS ? ': boolean' : ''} => {
  const normalized = hostname.toLowerCase();

  if (isTrustedParentHostname(normalized)) {
    return true;
  }

  return allowLocalhostForEnv(nodeEnv)
    && (normalized === 'localhost' || normalized === '127.0.0.1');
};

export const getBetterAuthTrustedOrigins = (nodeEnv${isTS ? ': NodeEnv | string' : ''})${isTS ? ': string[]' : ''} => {
  const explicitOrigins = parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS);
  if (explicitOrigins.length > 0) {
    return explicitOrigins;
  }

  const origins = [
    process.env.BACKEND_URL,
    ...parseCsv(process.env.CORS_ALLOWED_ORIGINS),
    ...(allowLocalhostForEnv(nodeEnv) ? localhostOrigins : []),
  ].filter(Boolean)${isTS ? ' as string[]' : ''};

  return Array.from(new Set(origins));
};
`;

  await fs.outputFile(path.join(projectPath, `src/config/trustedOrigins.${ext}`), content);
}

async function generateRequestLimits(projectPath: string, ext: string) {
  const content = `export const requestBodyLimits = {
  json: process.env.JSON_BODY_LIMIT || '256kb',
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 256 * 1024),
  urlencoded: process.env.URLENCODED_BODY_LIMIT || '32kb',
  urlencodedParameterLimit: Number(process.env.URLENCODED_PARAMETER_LIMIT || 100),
} as const;
`;

  await fs.outputFile(
    path.join(projectPath, `src/config/requestLimits.${ext}`),
    ext === 'ts' ? content : content.replace(' as const', '')
  );
}

async function generateCorsMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const content = isTS
    ? `import cors, { type CorsOptions } from 'cors';
import { config } from '../config/index.js';
import { isAllowedCorsHostname } from '../config/trustedOrigins.js';

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

const getNodeEnv = (): string => (config as any).nodeEnv || (config as any).env || process.env.NODE_ENV || 'development';
const createCorsError = (message: string): Error & { statusCode: number } =>
  Object.assign(new Error(message), { statusCode: 403 });

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: CorsOriginCallback) => {
    if (!origin) {
      return callback(null, true);
    }

    try {
      const { hostname } = new URL(origin);
      if (isAllowedCorsHostname(hostname, getNodeEnv())) {
        return callback(null, true);
      }

      return callback(createCorsError('Origin is not allowed'));
    } catch {
      return callback(createCorsError('Invalid origin'));
    }
  },
  credentials: true,
};

export default cors(corsOptions);
`
    : `import cors from 'cors';
import { config } from '../config/index.js';
import { isAllowedCorsHostname } from '../config/trustedOrigins.js';

const getNodeEnv = () => config.nodeEnv || config.env || process.env.NODE_ENV || 'development';
const createCorsError = (message) => Object.assign(new Error(message), { statusCode: 403 });

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    try {
      const { hostname } = new URL(origin);
      if (isAllowedCorsHostname(hostname, getNodeEnv())) {
        return callback(null, true);
      }

      return callback(createCorsError('Origin is not allowed'));
    } catch {
      return callback(createCorsError('Invalid origin'));
    }
  },
  credentials: true,
};

export default cors(corsOptions);
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/cors.middleware.${ext}`), content);
}

async function generateOriginVerifyMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const content = `${isTS ? "import type { NextFunction, Request, Response } from 'express';\n" : ''}import { timingSafeEqual } from 'crypto';
import { config } from '../config/index.js';

const HEADER_NAME = 'x-origin-verify';

const safeEquals = (left${isTS ? ': string' : ''}, right${isTS ? ': string' : ''})${isTS ? ': boolean' : ''} => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const originVerify = (req${isTS ? ': Request' : ''}, res${isTS ? ': Response' : ''}, next${isTS ? ': NextFunction' : ''}) => {
  const configured = (config${isTS ? ' as any' : ''}).originVerifySecret || process.env.ORIGIN_VERIFY_SECRET;
  if (!configured) {
    return next();
  }

  const provided = req.get(HEADER_NAME);
  if (!provided || !safeEquals(provided, configured)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }

  return next();
};

export default originVerify;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/originVerify.middleware.${ext}`), content);
}

async function generateRequestSizeMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const content = `${isTS ? "import type { NextFunction, Request, Response } from 'express';\n" : ''}import { requestBodyLimits } from '../config/requestLimits.js';

const requestSizeGuard = (req${isTS ? ': Request' : ''}, res${isTS ? ': Response' : ''}, next${isTS ? ': NextFunction' : ''}) => {
  const contentLengthHeader = req.header('content-length');
  if (!contentLengthHeader) {
    return next();
  }

  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Content-Length header',
    });
  }

  if (contentLength > requestBodyLimits.maxBodyBytes) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
    });
  }

  return next();
};

export default requestSizeGuard;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/requestSize.middleware.${ext}`), content);
}

async function generateCsrfMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const content = `${isTS ? "import type { NextFunction, Request, Response } from 'express';\n" : ''}import { config } from '../config/index.js';
import { allowLocalhostForEnv, isTrustedParentHostname } from '../config/trustedOrigins.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const getNodeEnv = ()${isTS ? ': string' : ''} => (config${isTS ? ' as any' : ''}).nodeEnv || (config${isTS ? ' as any' : ''}).env || process.env.NODE_ENV || 'development';

const hasAuthCookie = (req${isTS ? ': Request' : ''})${isTS ? ': boolean' : ''} => {
  const cookies = req.cookies ?? {};
  return Boolean(Object.keys(cookies).some(name =>
    name === 'access_session' || name.startsWith('better-auth.') || name.startsWith('nod.')
  ));
};

const isTrustedHostname = (hostname${isTS ? ': string' : ''})${isTS ? ': boolean' : ''} => {
  const normalized = hostname.toLowerCase();
  const nodeEnv = getNodeEnv();

  if (allowLocalhostForEnv(nodeEnv) && (normalized === 'localhost' || normalized === '127.0.0.1')) {
    return true;
  }

  return isTrustedParentHostname(normalized);
};

const getRequestOrigin = (req${isTS ? ': Request' : ''})${isTS ? ': string | null' : ''} => req.get('origin') || req.get('referer') || null;

const csrfProtection = (req${isTS ? ': Request' : ''}, res${isTS ? ': Response' : ''}, next${isTS ? ': NextFunction' : ''}) => {
  if (!UNSAFE_METHODS.has(req.method) || !hasAuthCookie(req)) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    return res.status(403).json({ success: false, message: 'Cross-site request validation failed' });
  }

  try {
    const { hostname, protocol } = new URL(requestOrigin);
    if (protocol !== 'https:' && !(getNodeEnv() !== 'production' && protocol === 'http:')) {
      throw new Error('Untrusted request protocol');
    }

    if (!isTrustedHostname(hostname)) {
      throw new Error('Untrusted request origin');
    }

    return next();
  } catch {
    return res.status(403).json({ success: false, message: 'Cross-site request validation failed' });
  }
};

export default csrfProtection;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/csrf.middleware.${ext}`), content);
}

async function generateCookieSession(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const secret = randomBytes(32).toString('hex');
  const helperContent = `${isTS ? "import type { Response } from 'express';\n" : ''}import { createHmac, timingSafeEqual } from 'crypto';

export const ACCESS_SESSION_COOKIE_NAME = 'access_session';

const getSecret = ()${isTS ? ': string' : ''} => process.env.SESSION_SECRET || '${secret}';

const sign = (value${isTS ? ': string' : ''})${isTS ? ': string' : ''} =>
  createHmac('sha256', getSecret()).update(value).digest('base64url');

const safeEquals = (left${isTS ? ': string' : ''}, right${isTS ? ': string' : ''})${isTS ? ': boolean' : ''} => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const createAccessSession = (payload${isTS ? ': Record<string, unknown>' : ''})${isTS ? ': string' : ''} => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return \`\${body}.\${sign(body)}\`;
};

export const verifyAccessSession = (token${isTS ? ': string | undefined' : ''})${isTS ? ': Record<string, unknown> | null' : ''} => {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [body, signature] = token.split('.');
  if (!body || !signature || !safeEquals(signature, sign(body))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

export const setAccessSessionCookie = (res${isTS ? ': Response' : ''}, payload${isTS ? ': Record<string, unknown>' : ''}) => {
  res.cookie(ACCESS_SESSION_COOKIE_NAME, createAccessSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
};
`;

  const middlewareContent = `${isTS ? "import type { NextFunction, Request, Response } from 'express';\n" : ''}import { ACCESS_SESSION_COOKIE_NAME, verifyAccessSession } from '../helpers/accessSession.helper.js';

const sessionAuth = (req${isTS ? ': Request & { user?: unknown }' : ''}, res${isTS ? ': Response' : ''}, next${isTS ? ': NextFunction' : ''}) => {
  const payload = verifyAccessSession(req.cookies?.[ACCESS_SESSION_COOKIE_NAME]);
  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  req.user = payload;
  return next();
};

export default sessionAuth;
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/accessSession.helper.${ext}`), helperContent);
  await fs.outputFile(path.join(projectPath, `src/middleware/sessionAuth.middleware.${ext}`), middlewareContent);
}

async function generateBetterAuth(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  const helperContent = isTS
    ? `import { betterAuth as createBetterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import bcrypt from 'bcryptjs';

import config from '../config/config.js';
import { getBetterAuthTrustedOrigins } from '../config/trustedOrigins.js';
import database from '../db/index.js';

interface AuthProviderDependencies {
  db: typeof database;
  config: {
    backendUrl?: string;
    authSecret: string;
    nodeEnv: string;
  };
  trustedOrigins?: string[];
}

export const createAuthProvider = ({ db, config, trustedOrigins = [] }: AuthProviderDependencies) =>
  createBetterAuth({
    baseURL: config.backendUrl,
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    secret: config.authSecret,
    basePath: '/api/auth/provider',
    emailAndPassword: {
      enabled: true,
      password: {
        hash: async (password: string) => bcrypt.hash(password, 10),
        verify: async ({ hash, password }) => bcrypt.compare(password, hash),
      },
    },
    advanced: {
      useSecureCookies: config.backendUrl?.startsWith('https://') || config.nodeEnv === 'staging' || config.nodeEnv === 'production',
      database: {
        generateId: 'uuid',
      },
    },
    trustedOrigins,
  });

export const auth = createAuthProvider({
  db: database,
  config,
  trustedOrigins: getBetterAuthTrustedOrigins(config.nodeEnv),
});
`
    : `import { betterAuth as createBetterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import bcrypt from 'bcryptjs';

import config from '../config/config.js';
import { getBetterAuthTrustedOrigins } from '../config/trustedOrigins.js';
import database from '../db/index.js';

export const createAuthProvider = ({ db, config, trustedOrigins = [] }) =>
  createBetterAuth({
    baseURL: config.backendUrl,
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    secret: config.authSecret,
    basePath: '/api/auth/provider',
    emailAndPassword: {
      enabled: true,
      password: {
        hash: async (password) => bcrypt.hash(password, 10),
        verify: async ({ hash, password }) => bcrypt.compare(password, hash),
      },
    },
    advanced: {
      useSecureCookies: config.backendUrl?.startsWith('https://') || config.nodeEnv === 'staging' || config.nodeEnv === 'production',
      database: {
        generateId: 'uuid',
      },
    },
    trustedOrigins,
  });

export const auth = createAuthProvider({
  db: database,
  config,
  trustedOrigins: getBetterAuthTrustedOrigins(config.nodeEnv),
});
`;

  const middlewareContent = isTS
    ? `import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';

import { auth } from '../helpers/authProvider.helper.js';

const toRequestUser = (session: any) => {
  const user = session?.user;
  if (!user?.id) {
    return null;
  }

  const appMetadata = user.appMetadata ?? user.app_metadata ?? {};
  const userMetadata = user.userMetadata ?? user.user_metadata ?? {};

  return {
    ...user,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    permissions: user.permissions ?? appMetadata.permission,
    session_id: session.session?.id,
  };
};

const sessionAuth = async (req: Request & { user?: unknown }, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const user = toRequestUser(session);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
};

export default sessionAuth;
`
    : `import { fromNodeHeaders } from 'better-auth/node';

import { auth } from '../helpers/authProvider.helper.js';

const toRequestUser = (session) => {
  const user = session?.user;
  if (!user?.id) {
    return null;
  }

  const appMetadata = user.appMetadata ?? user.app_metadata ?? {};
  const userMetadata = user.userMetadata ?? user.user_metadata ?? {};

  return {
    ...user,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    permissions: user.permissions ?? appMetadata.permission,
    session_id: session.session?.id,
  };
};

const sessionAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const user = toRequestUser(session);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
};

export default sessionAuth;
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/authProvider.helper.${ext}`), helperContent);
  await fs.outputFile(path.join(projectPath, `src/middleware/sessionAuth.middleware.${ext}`), middlewareContent);
}
