import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

function getProjectTablePrefix(projectName: string): string {
  const [firstSegment] = projectName.split('-');
  return firstSegment || projectName;
}

export async function generateSupabaseHelper(projectPath: string, config: ProjectConfig, ext: string) {
  const usePooler = config.supabase?.usePooler;
  const hasDrizzle = config.orm === 'drizzle';
  const isTS = ext === 'ts';

  const supabaseHelperContent = isTS
    ? `import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const sbApiKey = config.supabaseApiKey;
const sbUrl = config.supabaseUrl;

export const supabase = createClient(sbUrl!, sbApiKey!);
export const supabaseAuthAdmin = supabase.auth.admin;

export const downloadFromSupabase = async (bucketName: string, filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);
    
    if (error) {
      logger.error(\`Error downloading \${filePath} from Supabase:\`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(\`Failed to download \${filePath}:\`, error);
    throw error;
  }
};

export const uploadToSupabase = async (
  bucketName: string, 
  filePath: string, 
  fileBuffer: Buffer | Blob, 
  options: any = {}
) => {
  try {
    logger.info(\`Uploading file to bucket: \${bucketName}, path: \${filePath}\`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, { upsert: true, ...options });
    
    if (error) {
      logger.error(\`Error uploading \${filePath} to Supabase:\`, error);
      throw error;
    }
    
    logger.info(\`Successfully uploaded \${filePath}\`);
    return data;
  } catch (error) {
    logger.error(\`Failed to upload \${filePath}:\`, error);
    throw error;
  }
};

export const getSignedUrl = async (bucketName: string, filePath: string, expiresIn: number = 86400) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      logger.error(\`Error generating signed URL for \${filePath}:\`, error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    logger.error(\`Error generating signed URL for \${filePath}:\`, error);
    return null;
  }
};

export default supabase;
`
    : `import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const sbApiKey = config.supabaseApiKey;
const sbUrl = config.supabaseUrl;

export const supabase = createClient(sbUrl, sbApiKey);
export const supabaseAuthAdmin = supabase.auth.admin;

export const downloadFromSupabase = async (bucketName, filePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);
    
    if (error) {
      logger.error(\`Error downloading \${filePath} from Supabase:\`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(\`Failed to download \${filePath}:\`, error);
    throw error;
  }
};

export const uploadToSupabase = async (bucketName, filePath, fileBuffer, options = {}) => {
  try {
    logger.info(\`Uploading file to bucket: \${bucketName}, path: \${filePath}\`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, { upsert: true, ...options });
    
    if (error) {
      logger.error(\`Error uploading \${filePath} to Supabase:\`, error);
      throw error;
    }
    
    logger.info(\`Successfully uploaded \${filePath}\`);
    return data;
  } catch (error) {
    logger.error(\`Failed to upload \${filePath}:\`, error);
    throw error;
  }
};

export const getSignedUrl = async (bucketName, filePath, expiresIn = 86400) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      logger.error(\`Error generating signed URL for \${filePath}:\`, error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    logger.error(\`Error generating signed URL for \${filePath}:\`, error);
    return null;
  }
};

export default supabase;
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/supabase.helper.${ext}`), supabaseHelperContent);

  // Generate Drizzle setup if enabled
  if (hasDrizzle) {
    await generateDrizzleSetup(projectPath, config, ext);
  }
}

async function generateDrizzleSetup(projectPath: string, config: ProjectConfig, ext: string) {
  const usePooler = config.supabase?.usePooler;
  const tablePrefixBase = getProjectTablePrefix(config.name);
  const auditTableName = `${tablePrefixBase}_api_audit`;
  const tablePrefix = `${tablePrefixBase}_*`;
  const isTS = ext === 'ts';

  const schemaFiles = config.auth === 'better-auth'
    ? `['./src/db/schema.${ext}', './src/db/generated-auth-schema.${ext}']`
    : `'./src/db/schema.${ext}'`;

  // Drizzle config
  const drizzleConfigContent = isTS
    ? `/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const env = process.env.NODE_ENV || 'staging';
const connectionString = env === 'production' 
  ? process.env.${usePooler ? 'SUPABASE_POOLER_URL' : 'DATABASE_URL'}
  : process.env.${usePooler ? 'SUPABASE_STAGING_POOLER_URL' : 'DATABASE_STAGING_URL'};

export default defineConfig({
  schema: ${schemaFiles},
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  tablesFilter: ['${tablePrefix}'],
  strict: true,
  dbCredentials: {
    url: connectionString!,
  },
});
`
    : `import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const env = process.env.NODE_ENV || 'staging';
const connectionString = env === 'production' 
  ? process.env.${usePooler ? 'SUPABASE_POOLER_URL' : 'DATABASE_URL'}
  : process.env.${usePooler ? 'SUPABASE_STAGING_POOLER_URL' : 'DATABASE_STAGING_URL'};

export default defineConfig({
  schema: ${schemaFiles},
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  tablesFilter: ['${tablePrefix}'],
  strict: true,
  dbCredentials: {
    url: connectionString,
  },
});
`;

  // Drizzle DB connection
  const schemaImports = config.auth === 'better-auth'
    ? `import * as appSchema from './schema.js';
import * as authSchema from './generated-auth-schema.js';

const schema = { ...appSchema, ...authSchema };
`
    : `import * as schema from './schema.js';
`;

  const drizzleDbContent = isTS
    ? `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/config.js';
${schemaImports}

const connectionString = config.${usePooler ? 'supabasePoolerUrl' : 'supabaseUrl'};

if (!connectionString) {
  throw new Error('Supabase pooler URL is not configured.');
}

const client = postgres(connectionString, {
  prepare: false,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });

export default db;
`
    : `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/config.js';
${schemaImports}

const connectionString = config.${usePooler ? 'supabasePoolerUrl' : 'supabaseUrl'};

if (!connectionString) {
  throw new Error('Supabase pooler URL is not configured.');
}

const client = postgres(connectionString, {
  prepare: false,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });

export default db;
`;

  // Schema - only api_audit table by default
  const schemaContent = `import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// API Audit table - logs all API requests
export const apiAudit = pgTable('${auditTableName}', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  eventType: text('event_type').notNull(),
  eventData: text('event_data'),
  llmResponse: jsonb('llm_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, table => [
  index('idx_${auditTableName}_user_id').on(table.userId),
  index('idx_${auditTableName}_event_type').on(table.eventType),
  index('idx_${auditTableName}_created_at').on(table.createdAt),
]);
`;

  await fs.outputFile(path.join(projectPath, `drizzle.config.${ext}`), drizzleConfigContent);
  await fs.outputFile(path.join(projectPath, `src/db/index.${ext}`), drizzleDbContent);
  await fs.outputFile(path.join(projectPath, `src/db/schema.${ext}`), schemaContent);

  if (config.auth === 'better-auth') {
    await fs.outputFile(path.join(projectPath, `src/db/generated-auth-schema.${ext}`), generateBetterAuthSchema(ext));
  }
}

function generateBetterAuthSchema(ext: string) {
  const isTS = ext === 'ts';
  const content = `import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  userMetadata: jsonb('user_metadata')${isTS ? '.$type<Record<string, unknown> | null>()' : ''},
  appMetadata: jsonb('app_metadata')${isTS ? '.$type<Record<string, unknown> | null>()' : ''},
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('idx_session_user_id').on(table.userId),
]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('idx_account_user_id').on(table.userId),
]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
`;

  return ext === 'ts' ? content : content.replace(/\.\$type<Record<string, unknown> \| null>\(\)/g, '');
}

export async function generateSupabaseJwtAuth(projectPath: string, ext: string, framework: 'express' | 'hono' = 'express') {
  const isTS = ext === 'ts';

  if (framework === 'hono') {
    const honoJwtAuthContent = isTS
      ? `import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Context, Next } from 'hono';
import config from '../config/config.js';

const SUPABASE_JWT_ISSUER = \`https://\${config.supabaseProject}.supabase.co/auth/v1\`;
const JWKS = createRemoteJWKSet(new URL(\`\${SUPABASE_JWT_ISSUER}/.well-known/jwks.json\`));

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  session_id?: string;
  is_anonymous?: boolean;
  app_metadata?: any;
  user_metadata?: any;
}

const jwtAuth = async (c: Context, next: Next): Promise<Response | void> => {
  try {
    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Access denied. No token provided or invalid format.' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
      algorithms: ['RS256', 'ES256'],
    });

    c.set('user', {
      id: payload.sub,
      email: (payload.app_metadata as any)?.original_email || payload.email,
      name: (payload.user_metadata as any)?.name || (payload.user_metadata as any)?.display_name || '',
      phone: (payload.app_metadata as any)?.phone || payload.phone,
      role: payload.role,
      session_id: payload.session_id,
      is_anonymous: payload.is_anonymous,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
    } as AuthUser);

    await next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error);
    if (error.code === 'ERR_JWT_EXPIRED') {
      return c.json({ success: false, message: 'Token expired.' }, 401);
    }
    return c.json({ success: false, message: 'Invalid or expired token.' }, 401);
  }
};

export default jwtAuth;
`
      : `import { jwtVerify, createRemoteJWKSet } from 'jose';
import config from '../config/config.js';

const SUPABASE_JWT_ISSUER = \`https://\${config.supabaseProject}.supabase.co/auth/v1\`;
const JWKS = createRemoteJWKSet(new URL(\`\${SUPABASE_JWT_ISSUER}/.well-known/jwks.json\`));

const jwtAuth = async (c, next) => {
  try {
    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Access denied. No token provided or invalid format.' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
      algorithms: ['RS256', 'ES256'],
    });

    c.set('user', {
      id: payload.sub,
      email: payload.app_metadata?.original_email || payload.email,
      name: payload.user_metadata?.name || payload.user_metadata?.display_name || '',
      phone: payload.app_metadata?.phone || payload.phone,
      role: payload.role,
      session_id: payload.session_id,
      is_anonymous: payload.is_anonymous,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
    });

    await next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    if (error.code === 'ERR_JWT_EXPIRED') {
      return c.json({ success: false, message: 'Token expired.' }, 401);
    }
    return c.json({ success: false, message: 'Invalid or expired token.' }, 401);
  }
};

export default jwtAuth;
`;

    const honoPermissionContent = isTS
      ? `export const checkPermission = (allowedRoles: string[] = ['org_admin', 'super_admin']) => {
  return async (c: any, next: any): Promise<Response | void> => {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ success: false, message: 'Authentication required' }, 401);
      }

      const permission = user.app_metadata?.permission || {};
      const source = c.get('requestSource') || 'default';
      const userRoleForSource = permission[source] || permission.default;

      if (!userRoleForSource) {
        return c.json({ success: false, message: 'No permission for this source' }, 403);
      }

      if (!allowedRoles.includes(userRoleForSource)) {
        return c.json({ success: false, message: 'Insufficient permissions' }, 403);
      }

      c.set('userRole', userRoleForSource);
      c.set('userSource', source);
      await next();
    } catch (error) {
      console.error('Permission check error:', error);
      return c.json({ success: false, message: 'Permission check failed' }, 500);
    }
  };
};

export default checkPermission;
`
      : `export const checkPermission = (allowedRoles = ['org_admin', 'super_admin']) => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ success: false, message: 'Authentication required' }, 401);
      }

      const permission = user.app_metadata?.permission || {};
      const source = c.get('requestSource') || 'default';
      const userRoleForSource = permission[source] || permission.default;

      if (!userRoleForSource) {
        return c.json({ success: false, message: 'No permission for this source' }, 403);
      }

      if (!allowedRoles.includes(userRoleForSource)) {
        return c.json({ success: false, message: 'Insufficient permissions' }, 403);
      }

      c.set('userRole', userRoleForSource);
      c.set('userSource', source);
      await next();
    } catch (error) {
      console.error('Permission check error:', error);
      return c.json({ success: false, message: 'Permission check failed' }, 500);
    }
  };
};

export default checkPermission;
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/jwtAuth.middleware.${ext}`), honoJwtAuthContent);
    await fs.outputFile(path.join(projectPath, `src/middleware/permission.middleware.${ext}`), honoPermissionContent);
    return;
  }
  
  // JWT Auth - different content for TS vs JS
  const jwtAuthContent = isTS 
    ? `import { jwtVerify, createRemoteJWKSet } from 'jose';
import config from '../config/config.js';

const SUPABASE_JWT_ISSUER = \`https://\${config.supabaseProject}.supabase.co/auth/v1\`;
const JWKS = createRemoteJWKSet(new URL(\`\${SUPABASE_JWT_ISSUER}/.well-known/jwks.json\`));

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  session_id?: string;
  is_anonymous?: boolean;
  app_metadata?: any;
  user_metadata?: any;
}

/**
 * JWT Authentication Middleware for Supabase
 * Verifies JWT tokens using JWKS
 */
const jwtAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.',
      });
    }

    const token = authHeader.split(' ')[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
      algorithms: ['RS256', 'ES256'],
    });

    req.user = {
      id: payload.sub,
      email: (payload.app_metadata as any)?.original_email || payload.email,
      name: (payload.user_metadata as any)?.name || (payload.user_metadata as any)?.display_name || '',
      phone: (payload.app_metadata as any)?.phone || payload.phone,
      role: payload.role,
      session_id: payload.session_id,
      is_anonymous: payload.is_anonymous,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
    } as AuthUser;

    next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error);
    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export default jwtAuth;
`
    : `import { jwtVerify, createRemoteJWKSet } from 'jose';
import config from '../config/config.js';

const SUPABASE_JWT_ISSUER = \`https://\${config.supabaseProject}.supabase.co/auth/v1\`;
const JWKS = createRemoteJWKSet(new URL(\`\${SUPABASE_JWT_ISSUER}/.well-known/jwks.json\`));

/**
 * JWT Authentication Middleware for Supabase
 * Verifies JWT tokens using JWKS
 */
const jwtAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.',
      });
    }

    const token = authHeader.split(' ')[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
      algorithms: ['RS256', 'ES256'],
    });

    req.user = {
      id: payload.sub,
      email: payload.app_metadata?.original_email || payload.email,
      name: payload.user_metadata?.name || payload.user_metadata?.display_name || '',
      phone: payload.app_metadata?.phone || payload.phone,
      role: payload.role,
      session_id: payload.session_id,
      is_anonymous: payload.is_anonymous,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
    };

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export default jwtAuth;
`;

  // Permission middleware - reads from JWT payload app_metadata.permission
  const permissionMiddlewareContent = isTS
    ? `/**
 * Permission middleware that checks user role from JWT app metadata.
 * Permission structure from JWT payload (req.user.app_metadata.permission):
 * {
 *   "default": "org_admin"
 * }
 */
export const checkPermission = (allowedRoles: string[] = ['org_admin', 'super_admin']) => {
  return (req: any, res: any, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get permission object from JWT payload
      const permission = req.user.app_metadata?.permission || {};
      
      const source = 'default';
      
      // Get user's role for this source from permission object
      const userRoleForSource = permission[source] || permission['default'];
      
      if (!userRoleForSource) {
        return res.status(403).json({
          success: false,
          message: 'No permission for this source'
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(userRoleForSource)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // Attach resolved role to request for downstream use
      req.userRole = userRoleForSource;
      req.userSource = source;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export default checkPermission;
`
    : `/**
 * Permission middleware that checks user role from JWT app metadata.
 * Permission structure from JWT payload (req.user.app_metadata.permission):
 * {
 *   "default": "org_admin"
 * }
 */
export const checkPermission = (allowedRoles = ['org_admin', 'super_admin']) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get permission object from JWT payload
      const permission = req.user.app_metadata?.permission || {};
      
      const source = 'default';
      
      // Get user's role for this source from permission object
      const userRoleForSource = permission[source] || permission['default'];
      
      if (!userRoleForSource) {
        return res.status(403).json({
          success: false,
          message: 'No permission for this source'
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(userRoleForSource)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // Attach resolved role to request for downstream use
      req.userRole = userRoleForSource;
      req.userSource = source;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export default checkPermission;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/jwtAuth.middleware.${ext}`), jwtAuthContent);
  await fs.outputFile(path.join(projectPath, `src/middleware/permission.middleware.${ext}`), permissionMiddlewareContent);
}
