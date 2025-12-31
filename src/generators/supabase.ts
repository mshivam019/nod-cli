import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

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
  const auditTableName = `${config.name.replace(/-/g, '_')}_api_audit`;
  const isTS = ext === 'ts';

  // Drizzle config
  const drizzleConfigContent = isTS
    ? `import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const env = process.env.NODE_ENV || 'staging';
const connectionString = env === 'production' 
  ? process.env.${usePooler ? 'SUPABASE_POOLER_URL' : 'DATABASE_URL'}
  : process.env.${usePooler ? 'SUPABASE_STAGING_POOLER_URL' : 'DATABASE_STAGING_URL'};

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
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
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
});
`;

  // Drizzle DB connection
  const drizzleDbContent = isTS
    ? `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/config.js';
import * as schema from './schema.js';

const connectionString = config.${usePooler ? 'supabasePoolerUrl' : 'supabaseUrl'};

const client = postgres(connectionString!, { 
  prepare: false,
  ${usePooler ? `max: 10,
  idle_timeout: 20,
  connect_timeout: 10,` : ''}
});

export const db = drizzle(client, { schema });

export default db;
`
    : `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/config.js';
import * as schema from './schema.js';

const connectionString = config.${usePooler ? 'supabasePoolerUrl' : 'supabaseUrl'};

const client = postgres(connectionString, { 
  prepare: false,
  ${usePooler ? `max: 10,
  idle_timeout: 20,
  connect_timeout: 10,` : ''}
});

export const db = drizzle(client, { schema });

export default db;
`;

  // Schema - only api_audit table by default
  const schemaContent = `import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// API Audit table - logs all API requests
export const apiAudit = pgTable('${auditTableName}', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  eventType: text('event_type').notNull(),
  eventData: text('event_data'),
  llmResponse: jsonb('llm_response'),
  createdAt: timestamp('created_at').defaultNow(),
});
`;

  await fs.outputFile(path.join(projectPath, `drizzle.config.${ext}`), drizzleConfigContent);
  await fs.outputFile(path.join(projectPath, `src/db/index.${ext}`), drizzleDbContent);
  await fs.outputFile(path.join(projectPath, `src/db/schema.${ext}`), schemaContent);
}

export async function generateSupabaseJwtAuth(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
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
    ? `import sourceConfig from '../utils/sourceConfig.js';

/**
 * Permission middleware that checks user role based on source
 * Permission structure from JWT payload (req.user.app_metadata.permission):
 * {
 *   "icici": "org_admin",
 *   "hdfc": "org_admin", 
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
      
      // Get source from request (set by sourceSelection middleware)
      const source = req.requestSource || sourceConfig.getSourceForRequest(req);
      
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
    : `import sourceConfig from '../utils/sourceConfig.js';

/**
 * Permission middleware that checks user role based on source
 * Permission structure from JWT payload (req.user.app_metadata.permission):
 * {
 *   "icici": "org_admin",
 *   "hdfc": "org_admin",
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
      
      // Get source from request (set by sourceSelection middleware)
      const source = req.requestSource || sourceConfig.getSourceForRequest(req);
      
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
