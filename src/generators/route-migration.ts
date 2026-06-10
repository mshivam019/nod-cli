import fs from 'fs-extra';
import * as path from 'path';

export interface RouteMigrationOptions {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  defaultMiddleware: string[];
  defaultRoles: string[];
}

export async function migrateRoutes(projectPath: string, ext: string, options: RouteMigrationOptions) {
  const routesDir = path.join(projectPath, 'src/routes');

  if (!await fs.pathExists(routesDir)) {
    console.log('No routes directory found, skipping route migration');
    return;
  }

  const routeFiles = await glob(routesDir, `*.${ext === 'ts' ? 'ts' : 'js'}`);

  for (const routeFile of routeFiles) {
    await migrateRouteFile(routeFile, ext, options);
  }
}

async function glob(dir: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(pattern) && !entry.name.includes('.d.')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      files.push(...await glob(fullPath, pattern));
    }
  }

  return files;
}

async function migrateRouteFile(filePath: string, ext: string, options: RouteMigrationOptions) {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath, `.${ext === 'ts' ? 'ts' : 'js'}`);

  // Skip if already using declarative pattern
  if (content.includes('const routes = [')) {
    console.log(`✓ Skipping ${fileName} - already using declarative pattern`);
    return;
  }

  // Parse routes from the file
  const routes = parseRoutes(content, fileName);

  if (routes.length === 0) {
    console.log(`⚠ No routes found in ${fileName}`);
    return;
  }

  // Generate new declarative route file
  const newContent = generateDeclarativeRoutes(content, routes, options);

  // Write the migrated file
  await fs.outputFile(filePath, newContent);
  console.log(`✓ Migrated ${fileName} to declarative pattern`);
}

interface ParsedRoute {
  method: string;
  path: string;
  handler: string;
  middlewares: string[];
  comment?: string;
}

function parseRoutes(content: string, fileName: string): ParsedRoute[] {
  const routes: ParsedRoute[] = [];

  // Match route definitions: router.method('path', middleware1, middleware2, handler)
  const routePattern = /router\.(\w+)\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*([^)]+))?\s*\)/g;
  let match;

  while ((match = routePattern.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    const routePath = match[2];
    const middlewaresStr = match[3] || '';

    // Skip if it's not a valid HTTP method
    if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
      continue;
    }

    // Parse middlewares
    const middlewares = middlewaresStr
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    // Extract handler (last item in the chain)
    const handler = middlewares.length > 0 ? middlewares[middlewares.length - 1] : '';

    // Extract comment above the route
    const comment = extractRouteComment(content, match.index);

    routes.push({
      method,
      path: routePath,
      handler,
      middlewares,
      comment
    });
  }

  return routes;
}

function extractRouteComment(content: string, routeIndex: number): string | undefined {
  // Look for JSDoc comments before the route
  const beforeRoute = content.substring(0, routeIndex);
  const lines = beforeRoute.split('\n');

  // Find the last comment block before the route
  let commentLines: string[] = [];
  let inComment = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    if (line.includes('*/')) {
      inComment = true;
      commentLines.unshift(line);
    } else if (line.includes('/*') && inComment) {
      commentLines.unshift(line);
      break;
    } else if (inComment && line.trim().startsWith('*')) {
      commentLines.unshift(line);
    } else if (inComment && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
      break;
    } else if (line.trim().startsWith('//')) {
      commentLines.unshift(line);
    } else if (line.trim().length > 0 && !inComment) {
      break;
    }
  }

  return commentLines.length > 0 ? commentLines.join('\n') : undefined;
}

function generateDeclarativeRoutes(originalContent: string, routes: ParsedRoute[], options: RouteMigrationOptions): string {
  const { defaultMiddleware, defaultRoles, hasAuth, hasAuditLogger } = options;

  // Build the imports section
  const importSection = generateImportsSection(originalContent);

  // Generate route entries
  const routeEntries = routes.map(route => {
    const method = route.method.toUpperCase();
    const disabled: string[] = [];
    const enabled: string[] = [];
    let roles: string[] | undefined;

    // Analyze middlewares to determine disabled/enabled/roles
    for (const middleware of route.middlewares) {
      if (middleware === route.handler) continue; // Skip handler

      // Check for role middleware
      if (middleware.includes('role') || middleware.includes('Role')) {
        // Try to extract roles from the middleware call
        const roleMatch = middleware.match(/roleMiddleware\s*\(\s*\[([^\]]+)\]/);
        if (roleMatch) {
          roles = roleMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
        } else {
          const singleRoleMatch = middleware.match(/roleMiddleware\s*\(\s*['"]([^'"]+)['"]\s*\)/);
          if (singleRoleMatch) {
            roles = [singleRoleMatch[1]];
          }
        }
        continue;
      }

      // Check if middleware is in defaults
      const isDefault = defaultMiddleware.some(defaultMw =>
        middleware.includes(defaultMw) || defaultMw.includes(middleware)
      );

      if (!isDefault) {
        enabled.push(extractMiddlewareName(middleware));
      }
    }

    // Generate the route entry
    const lines: string[] = [];

    if (route.comment) {
      lines.push(route.comment);
    }

    lines.push('  {');
    lines.push(`    method: METHODS.${method},`);
    lines.push(`    path: '${route.path}',`);
    lines.push(`    handler: ${route.handler}`);

    if (disabled.length > 0) {
      lines.push(`    disabled: [${disabled.map(d => `'${d}'`).join(', ')}]`);
    }

    if (enabled.length > 0) {
      lines.push(`    enabled: [${enabled.map(e => `'${e}'`).join(', ')}]`);
    }

    if (roles && roles.length > 0) {
      lines.push(`    roles: [${roles.map(r => `'${r}'`).join(', ')}]`);
    }

    lines.push('  },');

    return lines.join('\n');
  }).join('\n\n');

  // Build default middleware list string
  const middlewareListStr = defaultMiddleware.length > 0
    ? defaultMiddleware.map(m => `'${m}'`).join(', ')
    : '';

  const rolesListStr = defaultRoles.length > 0
    ? defaultRoles.map(r => `'${r}'`).join(', ')
    : '';

  const isTS = originalContent.includes('import') && originalContent.includes('from');

  const newContent = isTS
    ? `${importSection}

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
const defaultRoles: string[] = [${rolesListStr}];

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
${routeEntries}
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({
  defaultMiddlewares,
  defaultRoles,
  routes
});
configuredRouter.applyToExpress(router);
`
    : `${importSection}

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
const defaultRoles = [${rolesListStr}];

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
${routeEntries}
];

// Apply routes using the configured router
const configuredRouter = createConfiguredRouter({
  defaultMiddlewares,
  defaultRoles,
  routes
});
configuredRouter.applyToExpress(router);
`;

  return newContent;
}

function generateImportsSection(content: string): string {
  const imports: string[] = [];

  // Extract existing imports
  const importPattern = /import\s+.*\s+from\s+['"].*['"]/g;
  let match;

  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[0]);
  }

  // Add required imports for declarative pattern
  const hasRouterImport = imports.some(i => i.includes('Router'));
  if (!hasRouterImport) {
    imports.unshift("import { Router } from 'express';");
  }

  imports.push("import { createConfiguredRouter, METHODS } from '../config/router.js';");

  return imports.join('\n');
}

function extractMiddlewareName(middleware: string): string {
  // Handle various middleware formats:
  // - middlewareFunction
  // - middlewareFunction()
  // - someModule.middlewareFunction
  // - someModule.middlewareFunction()

  let name = middleware.trim();

  // Remove function call parentheses
  if (name.endsWith('()')) {
    name = name.slice(0, -2);
  }

  // Handle module.path notation
  const lastDot = name.lastIndexOf('.');
  if (lastDot > -1) {
    name = name.substring(lastDot + 1);
  }

  return name;
}
