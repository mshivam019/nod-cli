import fs from 'fs-extra';
import * as path from 'path';

/**
 * Declarative Route Builder with Automatic Response Handling
 *
 * Features:
 * - Declarative route definitions with METHODS.GET pattern
 * - Automatic response wrapping (controllers return data, framework handles JSON)
 * - Error handling with status codes from thrown errors
 * - Default middlewares applied to all routes
 * - Role-based access control
 */

export async function generateImprovedRouteBuilder(projectPath: string, ext: string, options: {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
} = { hasAuth: false, hasAuditLogger: false, hasSourceSelection: false }) {
  const isTS = ext === 'ts';
  const { hasAuth, hasAuditLogger, hasSourceSelection } = options;

  const content = isTS
    ? `/**
 * Express Declarative Route Builder
 *
 * Provides a declarative way to define routes with middleware and role configuration.
 * Controllers just return data - the framework handles JSON responses and errors.
 *
 * Usage:
 * - Routes defined as: { method: METHODS.GET, path: '/path', handler: controller.method }
 * - Controllers return: { success: true, data: {...}, message: '...' }
 * - Services throw: new Error('message') with optional statusCode
 *
 * Example:
 * const routes = [
 *   { method: METHODS.GET, path: '/users', handler: userController.getUsers },
 *   { method: METHODS.POST, path: '/users', handler: userController.createUser, roles: ['admin'] }
 * ];
 */

import { Router } from 'express';
import { wrapHandler, wrapResponse, createError, success, fail } from '../helpers/response-wrapper.js';
${hasAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${hasAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${hasSourceSelection ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

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
  disabled?: string[];      // Middlewares to exclude from defaults
  enabled?: string[];       // Additional middlewares to include
  roles?: string[];         // Roles required for this route (empty = public)
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

  /**
   * Register a middleware by name
   */
  registerMiddleware(name: string, middleware: Function): this {
    this.middlewareRegistry.set(name, middleware);
    return this;
  }

  /**
   * Build the middleware chain for a route
   */
  private buildMiddlewareChain(route: RouteDefinition): Function[] {
    const chain: Function[] = [];

    let middlewares = [...this.config.defaultMiddlewares];
    let roles = [...this.config.defaultRoles];

    // Remove disabled middlewares
    if (route.disabled && route.disabled.length > 0) {
      middlewares = middlewares.filter(m => !route.disabled!.includes(m));
    }

    // Add enabled middlewares
    if (route.enabled && route.enabled.length > 0) {
      middlewares.push(...route.enabled);
    }

    // Handle roles
    if (route.excludeRoles && route.excludeRoles.length > 0) {
      roles = roles.filter(r => !route.excludeRoles!.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    // Build middleware chain from registered middlewares
    for (const name of middlewares) {
      const middleware = this.middlewareRegistry.get(name);
      if (middleware) {
        chain.push(middleware);
      }
    }

    // Add role check if roles are specified
    if (roles.length > 0) {
      const roleCheckFactory = this.middlewareRegistry.get('roleCheck') as ((allowedRoles: string[]) => Function) | undefined;
      if (roleCheckFactory) {
        chain.push(roleCheckFactory(roles));
      }
    }

    return chain;
  }

  /**
   * Apply routes to an Express router
   */
  applyToExpress(router: any): void {
    for (const route of this.config.routes) {
      const middlewares = this.buildMiddlewareChain(route);

      // Wrap the handler with automatic response handling
      const wrappedHandler = wrapHandler(route.handler);

      router[route.method](route.path, ...middlewares, wrappedHandler);
    }
  }
}

/**
 * Role check middleware factory
 */
export function roleCheck(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required', statusCode: 401 });
    }

    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions', statusCode: 403 });
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
  routes: any[];
}) {
  const router = new DeclarativeRouter({
    defaultMiddlewares: config.defaultMiddlewares,
    defaultRoles: config.defaultRoles,
    routes: config.routes
  });

  // Register all available middlewares
  ${hasAuth ? "router.registerMiddleware('jwtAuth', jwtAuth);" : ''}
  ${hasAuditLogger ? "router.registerMiddleware('auditLogger', auditLogger);" : ''}
  ${hasSourceSelection ? "router.registerMiddleware('sourceSelection', sourceSelection);" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

// Export helpers for convenience
export { wrapHandler, wrapResponse, createError, success, fail };
`
    : `/**
 * Express Declarative Route Builder
 *
 * Provides a declarative way to define routes with middleware and role configuration.
 * Controllers just return data - the framework handles JSON responses and errors.
 *
 * Usage:
 * - Routes defined as: { method: METHODS.GET, path: '/path', handler: controller.method }
 * - Controllers return: { success: true, data: {...}, message: '...' }
 * - Services throw: new Error('message') with optional statusCode
 *
 * Example:
 * const routes = [
 *   { method: METHODS.GET, path: '/users', handler: userController.getUsers },
 *   { method: METHODS.POST, path: '/users', handler: userController.createUser, roles: ['admin'] }
 * ];
 */

import { Router } from 'express';
import { wrapHandler, wrapResponse, createError, success, fail } from '../helpers/response-wrapper.js';
${hasAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${hasAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${hasSourceSelection ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

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

  /**
   * Register a middleware by name
   */
  registerMiddleware(name, middleware) {
    this.middlewareRegistry.set(name, middleware);
    return this;
  }

  /**
   * Build the middleware chain for a route
   */
  buildMiddlewareChain(route) {
    const chain = [];

    let middlewares = [...this.config.defaultMiddlewares];
    let roles = [...this.config.defaultRoles];

    // Remove disabled middlewares
    if (route.disabled && route.disabled.length > 0) {
      middlewares = middlewares.filter(m => !route.disabled.includes(m));
    }

    // Add enabled middlewares
    if (route.enabled && route.enabled.length > 0) {
      middlewares.push(...route.enabled);
    }

    // Handle roles
    if (route.excludeRoles && route.excludeRoles.length > 0) {
      roles = roles.filter(r => !route.excludeRoles.includes(r));
    }

    if (route.roles) {
      roles = route.roles;
    }

    // Build middleware chain from registered middlewares
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

  /**
   * Apply routes to an Express router
   */
  applyToExpress(router) {
    for (const route of this.config.routes) {
      const middlewares = this.buildMiddlewareChain(route);

      // Wrap the handler with automatic response handling
      const wrappedHandler = wrapHandler(route.handler);

      router[route.method](route.path, ...middlewares, wrappedHandler);
    }
  }
}

/**
 * Role check middleware factory
 */
function roleCheck(allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required', statusCode: 401 });
    }

    const userRole = user.role || user.user_metadata?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions', statusCode: 403 });
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

  // Register all available middlewares
  ${hasAuth ? "router.registerMiddleware('jwtAuth', jwtAuth);" : ''}
  ${hasAuditLogger ? "router.registerMiddleware('auditLogger', auditLogger);" : ''}
  ${hasSourceSelection ? "router.registerMiddleware('sourceSelection', sourceSelection);" : ''}
  router.registerMiddleware('roleCheck', roleCheck);

  return router;
}

// Export helpers for convenience
export { wrapHandler, wrapResponse, createError, success, fail };
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/route-builder.${ext}`), content);
}
