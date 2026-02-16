import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig, TemplateContext } from '../../types/index.js';

export async function generateExpressProject(
  projectPath: string,
  config: ProjectConfig,
  ctx: TemplateContext
) {
  await generateAppFile(projectPath, config, ctx);
  await generateServerFile(projectPath, config, ctx);
  await generateMiddleware(projectPath, config, ctx);

  if (config.database !== 'none') {
    await generateDatabaseConnection(projectPath, config, ctx);
  }

  if (config.features.cron) {
    await generateCronSetup(projectPath, ctx, config);
  }

  await generateExampleRoute(projectPath, ctx);
}

async function generateAppFile(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';

  const appContent = isTS
    ? `import express, { Express, Request, Response } from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}
import errorHandler from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', router);

  // Error handler (must be last)
  app.use(errorHandler);

  ${ctx.hasCron ? 'initCronJobs();' : ''}

  return app;
}
`
    : `import express from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}
import errorHandler from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', router);

  // Error handler (must be last)
  app.use(errorHandler);

  ${ctx.hasCron ? 'initCronJobs();' : ''}

  return app;
}
`;

  await fs.outputFile(path.join(projectPath, `src/app.${ext}`), appContent);
}

async function generateServerFile(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const needsDbConnect = ctx.hasDatabase && !ctx.hasDrizzle;

  const serverContent = `import { createApp } from './app.js';
import { config } from './config/index.js';
${needsDbConnect ? "import { connectDatabase } from './db/index.js';" : ''}

async function startServer() {
  ${needsDbConnect ? 'await connectDatabase();' : ''}

  const app = createApp();

  app.listen(config.port, () => {
    console.log(\`🚀 Server running on port \${config.port}\`);
  });
}

startServer().catch(console.error);
`;

  await fs.outputFile(path.join(projectPath, `src/server.${ext}`), serverContent);
}

async function generateMiddleware(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';

  // Response wrapper for automatic response handling
  const responseWrapperContent = isTS
    ? `/**
 * Response Wrapper for Automatic Response Handling
 *
 * Controllers return { success, data, message } - framework handles JSON
 * Services throw errors with .statusCode - framework handles status
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface ApiError extends Error {
  statusCode?: number;
}

/**
 * Wrap async controller handler with automatic response/error handling
 */
export function wrapHandler<T>(
  handler: (req: any, res: any) => Promise<ApiResponse<T>>
): (req: any, res: any, _next: any) => void {
  return async (req: any, res: any, _next: any) => {
    try {
      const response = await handler(req, res);

      if (response.success !== false) {
        // Success response - default 200 or custom status
        const statusCode = response.statusCode || 200;
        res.status(statusCode).json({
          success: true,
          ...(response.data !== undefined && { data: response.data }),
          ...(response.message && { message: response.message })
        });
      } else {
        // Explicit error response
        const statusCode = response.statusCode || 400;
        res.status(statusCode).json({
          success: false,
          ...(response.error && { error: response.error }),
          ...(response.message && { message: response.message })
        });
      }
    } catch (error) {
      // Handle thrown errors with status codes
      const statusCode = (error as ApiError).statusCode || 500;
      const message = (error as Error).message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && (error as Error).stack && { stack: (error as Error).stack })
      });
    }
  };
}

/**
 * Create error with status code (for services to throw)
 */
export function createError(message: string, statusCode: number = 500): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  return error;
}

/**
 * Helper to create successful response
 */
export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Helper to create error response
 */
export function fail(message: string, statusCode: number = 400): ApiResponse {
  return {
    success: false,
    error: message,
    statusCode
  };
}
`
    : `/**
 * Response Wrapper for Automatic Response Handling
 *
 * Controllers return { success, data, message } - framework handles JSON
 * Services throw errors with .statusCode - framework handles status
 */

/**
 * Wrap async controller handler with automatic response/error handling
 */
export function wrapHandler(handler) {
  return async (req, res, _next) => {
    try {
      const response = await handler(req, res);

      if (response.success !== false) {
        // Success response - default 200 or custom status
        const statusCode = response.statusCode || 200;
        res.status(statusCode).json({
          success: true,
          ...(response.data !== undefined && { data: response.data }),
          ...(response.message && { message: response.message })
        });
      } else {
        // Explicit error response
        const statusCode = response.statusCode || 400;
        res.status(statusCode).json({
          success: false,
          ...(response.error && { error: response.error }),
          ...(response.message && { message: response.message })
        });
      }
    } catch (error) {
      // Handle thrown errors with status codes
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && error.stack && { stack: error.stack })
      });
    }
  };
}

/**
 * Create error with status code (for services to throw)
 */
export function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Helper to create successful response
 */
export function success(data, message) {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * Helper to create error response
 */
export function fail(message, statusCode = 400) {
  return {
    success: false,
    error: message,
    statusCode
  };
}
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/response-wrapper.${ext}`), responseWrapperContent);

  // Error handler middleware
  const errorHandlerContent = isTS
    ? `import logger from '../utils/logger.js';

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

const errorHandler = (err: ErrorWithStatus, _req: any, res: any, _next: any) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default errorHandler;
`
    : `import logger from '../utils/logger.js';

const errorHandler = (err, _req, res, _next) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default errorHandler;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/errorHandler.${ext}`), errorHandlerContent);

  // Auth middleware (if enabled)
  if (ctx.hasAuth && !ctx.hasSupabaseAuth) {
    const authContent = isTS
      ? `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from '../helpers/response-wrapper.js';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  user?: any;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw createError('No token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    throw createError('Invalid token', 401);
  }
}

export function roleMiddleware(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw createError('Insufficient permissions', 403);
    }
    next();
  };
}
`
      : `import jwt from 'jsonwebtoken';
import { createError } from '../helpers/response-wrapper.js';
import { config } from '../config/index.js';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw createError('No token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    throw createError('Invalid token', 401);
  }
}

export function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw createError('Insufficient permissions', 403);
    }
    next();
  };
}
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/auth.${ext}`), authContent);
  }
}

async function generateDatabaseConnection(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  if (config.database === 'none') return;

  const ext = ctx.fileExt;
  let dbContent = '';

  if (config.database === 'pg') {
    dbContent = `import { Pool } from 'pg';
import { config } from '../config/index.js';

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  min: config.database.pool.min,
  max: config.database.pool.max,
});

export async function connectDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
`;
  } else if (config.database === 'mysql') {
    dbContent = `import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  connectionLimit: config.database.pool.max,
});

export async function connectDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
`;
  }

  await fs.outputFile(path.join(projectPath, `src/db/index.${ext}`), dbContent);
}

async function generateCronSetup(projectPath: string, ctx: TemplateContext, config: ProjectConfig) {
  const { generateThreadSafeCron } = await import('../pm2.js');

  // Determine lock backend based on database
  let lockBackend: 'redis' | 'postgres' | 'mysql' | 'file' = 'file';
  if (config.database === 'pg') {
    lockBackend = 'postgres';
  } else if (config.database === 'mysql') {
    lockBackend = 'mysql';
  }

  await generateThreadSafeCron(projectPath, ctx.fileExt, lockBackend);
}

async function generateExampleRoute(projectPath: string, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';

  // Build default middlewares list for route file
  const defaultMiddlewares: string[] = [];
  if (ctx.hasSupabaseAuth) {
    defaultMiddlewares.push('jwtAuth');
  }
  if (ctx.hasSupabaseAuth && ctx.hasApiAudit) {
    defaultMiddlewares.push('auditLogger');
  }
  if (ctx.hasSourceConfig) {
    defaultMiddlewares.push('sourceSelection');
  }

  const middlewareListStr = defaultMiddlewares.map(m => `'${m}'`).join(', ');

  // Generate route-builder helper
  await generateRouteBuilder(projectPath, ext, {
    hasAuth: ctx.hasSupabaseAuth,
    hasAuditLogger: ctx.hasApiAudit,
    hasSourceSelection: ctx.hasSourceConfig
  });

  // Generate router config (simple re-export)
  await generateRouterConfigSimple(projectPath, ext);

  // Generate declarative routes
  const routeContent = isTS
    ? `import { Router } from 'express';
import { createConfiguredRouter, METHODS, wrapHandler, success } from '../config/router.js';
import { exampleService } from '../services/example.js';

export const router = Router();

/**
 * Default middlewares applied to all routes
 * Can be overridden per-route using disabled/enabled
 */
const defaultMiddlewares: string[] = [${middlewareListStr}];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles
 */
const defaultRoles: string[] = [];

/**
 * Declarative route definitions
 *
 * Each route can have:
 * - method: METHODS.GET, METHODS.POST, etc.
 * - path: Route path
 * - handler: Controller method (wrapped automatically for response handling)
 * - disabled: Array of middleware names to exclude from defaults
 * - enabled: Array of additional middleware names to include
 * - roles: Override default roles (e.g., ['admin', 'superAdmin'])
 * - excludeRoles: Roles to exclude from defaults
 *
 * Controller examples:
 *   - return success(data, 'message') → 200 OK with data
 *   - return { success: true, data, message } → 200 OK
 *   - throw createError('msg', 404) → 404 Not Found
 *   - throw new Error('msg') (with .statusCode = 400) → 400 Bad Request
 */
const routes = [
  {
    method: METHODS.GET,
    path: '/example',
    handler: wrapHandler(async (_req: any, _res: any) => {
      const data = await exampleService.getData();
      return success(data, 'Data fetched successfully');
    })
  },

  {
    method: METHODS.GET,
    path: '/public',
    handler: wrapHandler(async (_req: any, _res: any) => success({ message: 'Public endpoint - no auth required' })),
    disabled: ${defaultMiddlewares.length > 0 ? `[${middlewareListStr}]` : '[]'}
  },

  {
    method: METHODS.POST,
    path: '/admin',
    handler: wrapHandler(async (_req: any, _res: any) => {
      return success({ message: 'Admin action performed' });
    }),
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes with automatic response handling
const configuredRouter = createConfiguredRouter({
  defaultMiddlewares,
  defaultRoles,
  routes
});
configuredRouter.applyToExpress(router);
`
    : `import { Router } from 'express';
import { createConfiguredRouter, METHODS, wrapHandler, success } from '../config/router.js';
import { exampleService } from '../services/example.js';

export const router = Router();

/**
 * Default middlewares applied to all routes
 * Can be overridden per-route using disabled/enabled
 */
const defaultMiddlewares = [${middlewareListStr}];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles
 */
const defaultRoles = [];

/**
 * Declarative route definitions
 *
 * Controller examples:
 *   - return success(data, 'message') → 200 OK with data
 *   - throw createError('msg', 404) → 404 Not Found
 */
const routes = [
  {
    method: METHODS.GET,
    path: '/example',
    handler: wrapHandler(async (_req, _res) => {
      const data = await exampleService.getData();
      return success(data, 'Data fetched successfully');
    })
  },

  {
    method: METHODS.GET,
    path: '/public',
    handler: wrapHandler(async (_req, _res) => success({ message: 'Public endpoint' })),
    disabled: ${defaultMiddlewares.length > 0 ? `[${middlewareListStr}]` : '[]'}
  },

  {
    method: METHODS.POST,
    path: '/admin',
    handler: wrapHandler(async (_req, _res) => {
      return success({ message: 'Admin action' });
    }),
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes with automatic response handling
const configuredRouter = createConfiguredRouter({
  defaultMiddlewares,
  defaultRoles,
  routes
});
configuredRouter.applyToExpress(router);
`;

  await fs.outputFile(path.join(projectPath, `src/routes/index.${ext}`), routeContent);

  // Controller
  const controllerContent = isTS
    ? `import { exampleService } from '../services/example.js';
import { success } from '../helpers/response-wrapper.js';

const exampleController = {
  async getData(_req: any, _res: any) {
    try {
      const data = await exampleService.getData();
      return success(data, 'Data fetched successfully');
    } catch (error) {
      throw error; // Re-throw for wrapHandler to handle
    }
  },

  async getPublic(_req: any, _res: any) {
    return success({ message: 'Public endpoint - no auth required' });
  },

  async adminAction(_req: any, _res: any) {
    try {
      // Admin logic here
      return success({ message: 'Admin action performed' });
    } catch (error) {
      throw error;
    }
  },
};

export default exampleController;
export { exampleController };
`
    : `import { exampleService } from '../services/example.js';
import { success } from '../helpers/response-wrapper.js';

const exampleController = {
  async getData(_req, _res) {
    try {
      const data = await exampleService.getData();
      return success(data, 'Data fetched successfully');
    } catch (error) {
      throw error;
    }
  },

  async getPublic(_req, _res) {
    return success({ message: 'Public endpoint - no auth required' });
  },

  async adminAction(_req, _res) {
    try {
      return success({ message: 'Admin action performed' });
    } catch (error) {
      throw error;
    }
  },
};

export default exampleController;
`;

  await fs.outputFile(path.join(projectPath, `src/controllers/example.${ext}`), controllerContent);

  // Service
  const serviceContent = `export const exampleService = {
  async getData() {
    // TODO: Implement your business logic here
    // Example: fetch from database, call external API, etc.

    return { message: 'Hello from nod-cli!' };
  },
};
`;

  await fs.outputFile(path.join(projectPath, `src/services/example.${ext}`), serviceContent);
}

// Helper functions for route generation
async function generateRouteBuilder(projectPath: string, ext: string, options: {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
}) {
  const isTS = ext === 'ts';
  const { hasAuth, hasAuditLogger, hasSourceSelection } = options;

  const content = isTS
    ? `/**
 * Express Declarative Route Builder
 *
 * Provides a declarative way to define routes with middleware and role configuration.
 * Controllers just return data - framework handles JSON responses and errors.
 *
 * Usage:
 * - Routes: { method: METHODS.GET, path: '/path', handler: controller.method }
 * - Controllers return: { success: true, data: {...}, message: '...' }
 * - Services throw: new Error('msg') with optional .statusCode
 */

import { wrapHandler, createError, success, fail } from '../helpers/response-wrapper.js';

export const METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
  HEAD: 'head',
  OPTIONS: 'options'
} as const;

export type HttpMethod = typeof METHODS[keyof typeof METHODS];

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Function;
  disabled?: string[];
  enabled?: string[];
  roles?: string[];
  excludeRoles?: string[];
}

export interface RouterConfig {
  defaultMiddlewares: string[];
  defaultRoles: string[];
  routes: RouteDefinition[];
}

export class DeclarativeRouter {
  private middlewareRegistry: Map<string, Function> = new Map();
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  registerMiddleware(name: string, middleware: Function): this {
    this.middlewareRegistry.set(name, middleware);
    return this;
  }

  private buildMiddlewareChain(route: RouteDefinition): Function[] {
    const chain: Function[] = [];
    let middlewares = [...this.config.defaultMiddlewares];
    let roles = [...this.config.defaultRoles];

    if (route.disabled && route.disabled.length > 0) {
      middlewares = middlewares.filter(m => !route.disabled!.includes(m));
    }

    if (route.enabled && route.enabled.length > 0) {
      middlewares.push(...route.enabled);
    }

    if (route.excludeRoles && route.excludeRoles.length > 0) {
      roles = roles.filter(r => !route.excludeRoles!.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    for (const name of middlewares) {
      const middleware = this.middlewareRegistry.get(name);
      if (middleware) {
        chain.push(middleware);
      }
    }

    if (roles.length > 0) {
      const roleMiddleware = this.middlewareRegistry.get('roleCheck');
      if (roleMiddleware) {
        chain.push((roleMiddleware as any)(roles));
      }
    }

    return chain;
  }

  applyToExpress(router: any): void {
    for (const route of this.config.routes) {
      const middlewares = this.buildMiddlewareChain(route);
      router[route.method](route.path, ...middlewares, route.handler);
    }
  }
}

export function roleCheck(allowedRoles: string[]) {
  return (req: any, _res: any, next: any) => {
    const user = req.user;
    if (!user) {
      throw createError('Authentication required', 401);
    }

    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw createError('Insufficient permissions', 403);
    }

    next();
  };
}

export function createConfiguredRouter(config: {
  defaultMiddlewares: string[];
  defaultRoles: string[];
  routes: any[];
}) {
  const router = new DeclarativeRouter({
    defaultMiddlewares: config.defaultMiddlewares,
    defaultRoles: config.defaultRoles,
    routes: config.routes
  });

  ${hasAuth ? "router.registerMiddleware('jwtAuth', (req, res, next) => { /* your auth middleware */ next(); });" : ''}
  ${hasAuditLogger ? "router.registerMiddleware('auditLogger', (req, res, next) => { /* your audit middleware */ next(); });" : ''}
  ${hasSourceSelection ? "router.registerMiddleware('sourceSelection', (req, res, next) => { /* your source middleware */ next(); });" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

// Export helpers
export { wrapHandler, success, fail, createError };
`
    : `/**
 * Express Declarative Route Builder
 *
 * Controllers just return data - framework handles JSON responses and errors.
 */

import { wrapHandler, createError, success, fail } from '../helpers/response-wrapper.js';

export const METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
  HEAD: 'head',
  OPTIONS: 'options'
};

export class DeclarativeRouter {
  constructor(config) {
    this.middlewareRegistry = new Map();
    this.config = config;
  }

  registerMiddleware(name, middleware) {
    this.middlewareRegistry.set(name, middleware);
    return this;
  }

  buildMiddlewareChain(route) {
    const chain = [];
    let middlewares = [...this.config.defaultMiddlewares];
    let roles = [...this.config.defaultRoles];

    if (route.disabled && route.disabled.length > 0) {
      middlewares = middlewares.filter(m => !route.disabled.includes(m));
    }

    if (route.enabled && route.enabled.length > 0) {
      middlewares.push(...route.enabled);
    }

    if (route.excludeRoles && route.excludeRoles.length > 0) {
      roles = roles.filter(r => !route.excludeRoles.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    for (const name of middlewares) {
      const middleware = this.middlewareRegistry.get(name);
      if (middleware) {
        chain.push(middleware);
      }
    }

    if (roles.length > 0) {
      const roleMiddleware = this.middlewareRegistry.get('roleCheck');
      if (roleMiddleware) {
        chain.push(roleMiddleware(roles));
      }
    }

    return chain;
  }

  applyToExpress(router) {
    for (const route of this.config.routes) {
      const middlewares = this.buildMiddlewareChain(route);
      router[route.method](route.path, ...middlewares, route.handler);
    }
  }
}

function roleCheck(allowedRoles) {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      throw createError('Authentication required', 401);
    }

    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw createError('Insufficient permissions', 403);
    }

    next();
  };
}

export function createConfiguredRouter(config) {
  const router = new DeclarativeRouter({
    defaultMiddlewares: config.defaultMiddlewares,
    defaultRoles: config.defaultRoles,
    routes: config.routes
  });

  ${hasAuth ? "router.registerMiddleware('jwtAuth', (req, res, next) => { next(); });" : ''}
  ${hasAuditLogger ? "router.registerMiddleware('auditLogger', (req, res, next) => { next(); });" : ''}
  ${hasSourceSelection ? "router.registerMiddleware('sourceSelection', (req, res, next) => { next(); });" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

// Export helpers
export { wrapHandler, success, fail, createError };
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/route-builder.${ext}`), content);
}

async function generateRouterConfig(projectPath: string, ext: string, options: {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
}) {
  const isTS = ext === 'ts';
  const { hasAuth, hasAuditLogger, hasSourceSelection } = options;

  const content = isTS
    ? `/**
 * Router Configuration
 */

import { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError } from '../helpers/route-builder.js';

export { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError };
`
    : `/**
 * Router Configuration
 */

import { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError } from '../helpers/route-builder.js';

export { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError };
`;

  await fs.outputFile(path.join(projectPath, `src/config/router.${ext}`), content);
}

async function generateRouterConfigSimple(projectPath: string, ext: string) {
  const content = `/**
 * Router Configuration (simple re-export for convenience)
 */

import { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError } from '../helpers/route-builder.js';

export { METHODS, createConfiguredRouter, wrapHandler, success, fail, createError };
`;

  await fs.outputFile(path.join(projectPath, `src/config/router.${ext}`), content);
}
