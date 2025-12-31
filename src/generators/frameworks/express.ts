import * as fs from 'fs-extra';
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
    ? `import express, { Express, Request, Response, NextFunction } from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', router);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  ${ctx.hasCron ? 'initCronJobs();' : ''}

  return app;
}
`
    : `import express from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', router);

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

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
  
  // Note: Using 'middleware' (singular) folder, not 'middlewares'
  
  if (ctx.hasAuth && !ctx.hasSupabaseAuth) {
    // Only generate basic JWT auth if not using Supabase auth
    const authMiddleware = isTS
      ? `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  user?: any;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function roleMiddleware(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
`
      : `import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/auth.${ext}`), authMiddleware);
  }

  // Error handler middleware
  const errorHandlerContent = isTS
    ? `import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

const errorHandler = (err: ErrorWithStatus, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default errorHandler;
`
    : `import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default errorHandler;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/errorHandler.${ext}`), errorHandlerContent);
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
  
  // Generate route-builder helper for Express
  await generateExpressRouteBuilder(projectPath, ctx);
  
  // Generate router config
  await generateExpressRouterConfig(projectPath, ctx);
  
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
  
  // Generate routes using declarative pattern with METHODS.GET style
  // defaultMiddlewares and defaultRoles arrays directly in the route file
  const routeContent = isTS
    ? `import { Router } from 'express';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { exampleController } from '../controllers/example.js';

export const router = Router();

/**
 * Default middlewares applied to all routes in this file
 * Can be overridden per-route using disabled/enabled arrays
 */
const defaultMiddlewares: string[] = [${middlewareListStr}];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles/excludeRoles arrays
 */
const defaultRoles: string[] = [];

/**
 * Route definitions with declarative middleware and role configuration
 * 
 * Each route can have:
 * - method: METHODS.GET, METHODS.POST, etc.
 * - path: Route path
 * - handler: Controller method
 * - disabled: Array of middleware names to exclude from defaults
 * - enabled: Array of additional middleware names to include
 * - roles: Override default roles (e.g., ['admin', 'superAdmin'])
 * - excludeRoles: Roles to exclude from defaults
 */
const routes = [
  // Protected route (uses all default middlewares)
  {
    method: METHODS.GET,
    path: '/example',
    handler: exampleController.getExample
  },
  
  // Public route (disable jwtAuth)
  {
    method: METHODS.GET,
    path: '/public',
    handler: exampleController.getPublic,
    disabled: ['jwtAuth', 'auditLogger']
  },
  
  // Admin only route
  {
    method: METHODS.POST,
    path: '/admin',
    handler: exampleController.adminAction,
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({ 
  defaultMiddlewares, 
  defaultRoles, 
  routes 
});
configuredRouter.applyToExpress(router);
`
    : `import { Router } from 'express';
import { createConfiguredRouter, METHODS } from '../config/router.js';
import { exampleController } from '../controllers/example.js';

export const router = Router();

/**
 * Default middlewares applied to all routes in this file
 * Can be overridden per-route using disabled/enabled arrays
 */
const defaultMiddlewares = [${middlewareListStr}];

/**
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles/excludeRoles arrays
 */
const defaultRoles = [];

/**
 * Route definitions with declarative middleware and role configuration
 * 
 * Each route can have:
 * - method: METHODS.GET, METHODS.POST, etc.
 * - path: Route path
 * - handler: Controller method
 * - disabled: Array of middleware names to exclude from defaults
 * - enabled: Array of additional middleware names to include
 * - roles: Override default roles (e.g., ['admin', 'superAdmin'])
 * - excludeRoles: Roles to exclude from defaults
 */
const routes = [
  // Protected route (uses all default middlewares)
  {
    method: METHODS.GET,
    path: '/example',
    handler: exampleController.getExample
  },
  
  // Public route (disable jwtAuth)
  {
    method: METHODS.GET,
    path: '/public',
    handler: exampleController.getPublic,
    disabled: ['jwtAuth', 'auditLogger']
  },
  
  // Admin only route
  {
    method: METHODS.POST,
    path: '/admin',
    handler: exampleController.adminAction,
    roles: ['admin', 'superAdmin']
  },
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({ 
  defaultMiddlewares, 
  defaultRoles, 
  routes 
});
configuredRouter.applyToExpress(router);
`;

  await fs.outputFile(path.join(projectPath, `src/routes/index.${ext}`), routeContent);

  // Controller with proper pattern - includes public and admin handlers
  const controllerContent = isTS
    ? `import { Request, Response, NextFunction } from 'express';
import { exampleService } from '../services/example.js';

const exampleController = {
  async getExample(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await exampleService.getData();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'Public endpoint - no auth required' });
    } catch (error) {
      next(error);
    }
  },

  async adminAction(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'Admin action performed' });
    } catch (error) {
      next(error);
    }
  },
};

export default exampleController;
export { exampleController };
`
    : `import { exampleService } from '../services/example.js';

const exampleController = {
  async getExample(_req, res, next) {
    try {
      const data = await exampleService.getData();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getPublic(_req, res, next) {
    try {
      res.json({ message: 'Public endpoint - no auth required' });
    } catch (error) {
      next(error);
    }
  },

  async adminAction(_req, res, next) {
    try {
      res.json({ message: 'Admin action performed' });
    } catch (error) {
      next(error);
    }
  },
};

export default exampleController;
export { exampleController };
`;

  await fs.outputFile(path.join(projectPath, `src/controllers/example.${ext}`), controllerContent);

  // Simple service
  const serviceContent = `export const exampleService = {
  async getData() {
    // TODO: Implement your business logic here
    return { message: 'Hello from nod-cli!' };
  },
};
`;

  await fs.outputFile(path.join(projectPath, `src/services/example.${ext}`), serviceContent);
}

async function generateExpressRouteBuilder(projectPath: string, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';
  
  const content = isTS
    ? `/**
 * Express Declarative Route Builder
 * 
 * Provides a declarative way to define routes with middleware and role configuration.
 * Default middlewares and roles are applied to all routes unless explicitly disabled.
 */

export const METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch'
} as const;

export type HttpMethod = typeof METHODS[keyof typeof METHODS];

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Function;
  disabled?: string[];      // Middlewares to exclude from defaults
  enabled?: string[];       // Additional middlewares to include
  roles?: string[];         // Override default roles
  excludeRoles?: string[];  // Roles to exclude from defaults
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

    // Remove disabled middlewares
    if (route.disabled) {
      middlewares = middlewares.filter(m => !route.disabled!.includes(m));
    }

    // Add enabled middlewares
    if (route.enabled) {
      middlewares.push(...route.enabled);
    }

    // Handle roles
    if (route.excludeRoles) {
      roles = roles.filter(r => !route.excludeRoles!.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    // Build middleware chain
    for (const name of middlewares) {
      const middleware = this.middlewareRegistry.get(name);
      if (middleware) {
        chain.push(middleware);
      }
    }

    // Add role check if roles are specified
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
`
    : `/**
 * Express Declarative Route Builder
 * 
 * Provides a declarative way to define routes with middleware and role configuration.
 * Default middlewares and roles are applied to all routes unless explicitly disabled.
 */

export const METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch'
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

    // Remove disabled middlewares
    if (route.disabled) {
      middlewares = middlewares.filter(m => !route.disabled.includes(m));
    }

    // Add enabled middlewares
    if (route.enabled) {
      middlewares.push(...route.enabled);
    }

    // Handle roles
    if (route.excludeRoles) {
      roles = roles.filter(r => !route.excludeRoles.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    // Build middleware chain
    for (const name of middlewares) {
      const middleware = this.middlewareRegistry.get(name);
      if (middleware) {
        chain.push(middleware);
      }
    }

    // Add role check if roles are specified
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
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/route-builder.${ext}`), content);
}

async function generateExpressRouterConfig(projectPath: string, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';
  const useAuditLogger = ctx.hasSupabaseAuth && ctx.hasApiAudit;
  
  const content = isTS
    ? `/**
 * Router Configuration
 * 
 * Central configuration for route middlewares and role checking.
 */

import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
${ctx.hasSupabaseAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${useAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${ctx.hasSourceConfig ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

// Re-export METHODS for use in route files
export { METHODS };

/**
 * Role check middleware factory
 * Returns middleware that checks if user has one of the allowed roles
 */
export function roleCheck(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Create a configured router with registered middlewares
 */
export function createConfiguredRouter(config: { 
  defaultMiddlewares: string[]; 
  defaultRoles: string[];
  routes: any[] 
}) {
  const router = new DeclarativeRouter({
    defaultMiddlewares: config.defaultMiddlewares,
    defaultRoles: config.defaultRoles,
    routes: config.routes
  });

  // Register all middlewares
  ${ctx.hasSupabaseAuth ? "router.registerMiddleware('jwtAuth', jwtAuth);" : ''}
  ${useAuditLogger ? "router.registerMiddleware('auditLogger', auditLogger);" : ''}
  ${ctx.hasSourceConfig ? "router.registerMiddleware('sourceSelection', sourceSelection);" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

export default { createConfiguredRouter, METHODS, roleCheck };
`
    : `/**
 * Router Configuration
 * 
 * Central configuration for route middlewares and role checking.
 */

import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
${ctx.hasSupabaseAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${useAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${ctx.hasSourceConfig ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

// Re-export METHODS for use in route files
export { METHODS };

/**
 * Role check middleware factory
 * Returns middleware that checks if user has one of the allowed roles
 */
export function roleCheck(allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Create a configured router with registered middlewares
 */
export function createConfiguredRouter(config) {
  const router = new DeclarativeRouter({
    defaultMiddlewares: config.defaultMiddlewares,
    defaultRoles: config.defaultRoles,
    routes: config.routes
  });

  // Register all middlewares
  ${ctx.hasSupabaseAuth ? "router.registerMiddleware('jwtAuth', jwtAuth);" : ''}
  ${useAuditLogger ? "router.registerMiddleware('auditLogger', auditLogger);" : ''}
  ${ctx.hasSourceConfig ? "router.registerMiddleware('sourceSelection', sourceSelection);" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

export default { createConfiguredRouter, METHODS, roleCheck };
`;

  await fs.outputFile(path.join(projectPath, `src/config/router.${ext}`), content);
}
