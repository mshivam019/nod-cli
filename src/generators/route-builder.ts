import fs from 'fs-extra';
import * as path from 'path';

export async function generateRouteBuilder(projectPath: string, ext: string, options: {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
} = { hasAuth: false, hasAuditLogger: false, hasSourceSelection: false }) {
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
  roles?: string[];         // Override default roles (empty = no restriction)
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
