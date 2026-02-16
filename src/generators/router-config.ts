import fs from 'fs-extra';
import * as path from 'path';

export async function generateRouterConfig(projectPath: string, ext: string, options: {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
} = { hasAuth: false, hasAuditLogger: false, hasSourceSelection: false }) {
  const isTS = ext === 'ts';
  const { hasAuth, hasAuditLogger, hasSourceSelection } = options;

  const content = isTS
    ? `/**
 * Router Configuration
 *
 * Central configuration for route middlewares and role checking.
 * Import this file to get access to METHODS and createConfiguredRouter.
 */

import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
${hasAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${hasAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${hasSourceSelection ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

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
 *
 * @param config - Router configuration
 * @param config.defaultMiddlewares - Array of middleware names to apply to all routes
 * @param config.defaultRoles - Array of roles required for all routes (empty = public)
 * @param config.routes - Array of route definitions
 * @returns Configured DeclarativeRouter instance
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

export default { createConfiguredRouter, METHODS, roleCheck };
`
    : `/**
 * Router Configuration
 *
 * Central configuration for route middlewares and role checking.
 * Import this file to get access to METHODS and createConfiguredRouter.
 */

import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
${hasAuth ? "import jwtAuth from '../middleware/jwtAuth.middleware.js';" : ''}
${hasAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
${hasSourceSelection ? "import { sourceSelection } from '../middleware/sourceSelection.middleware.js';" : ''}

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
 *
 * @param config - Router configuration
 * @param config.defaultMiddlewares - Array of middleware names to apply to all routes
 * @param config.defaultRoles - Array of roles required for all routes (empty = public)
 * @param config.routes - Array of route definitions
 * @returns Configured DeclarativeRouter instance
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

export default { createConfiguredRouter, METHODS, roleCheck };
`;

  await fs.outputFile(path.join(projectPath, `src/config/router.${ext}`), content);
}
