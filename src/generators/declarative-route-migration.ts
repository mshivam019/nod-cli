import fs from 'fs-extra';
import * as path from 'path';

export interface MigrationOptions {
  hasAuth: boolean;
  hasAuditLogger: boolean;
  hasSourceSelection: boolean;
  defaultMiddleware: string[];
  defaultRoles: string[];
}

/**
 * Migrate existing routes to declarative pattern
 * - Preserves JS/TS format (no conversion)
 * - Converts to declarative route definitions with METHODS.GET
 * - Preserves all comments
 */
export async function migrateRoutesToDeclarative(projectPath: string, fileExt: string, options: MigrationOptions) {
  const routesDir = path.join(projectPath, 'src/routes');

  if (!await fs.pathExists(routesDir)) {
    console.log('No routes directory found');
    return;
  }

  const routeFiles: string[] = [];
  const entries = await fs.readdir(routesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.' + fileExt)) {
      routeFiles.push(path.join(routesDir, entry.name));
    }
  }

  if (routeFiles.length === 0) {
    console.log('No route files found');
    return;
  }

  console.log('Migrating ' + routeFiles.length + ' route file(s)...');

  for (const routeFile of routeFiles) {
    await migrateRouteFile(routeFile, fileExt, options);
  }
}

async function migrateRouteFile(filePath: string, fileExt: string, options: MigrationOptions) {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.' + fileExt);

  const skipIfDeclarative = content.includes('const routes = [') || content.includes('METHODS.GET');

  if (skipIfDeclarative) {
    console.log('Skipping ' + fileName + ' - already using declarative pattern');
    return;
  }

  const result = parseRoutes(content);

  if (result.routes.length === 0) {
    console.log('No routes found in ' + fileName);
    return;
  }

  console.log('Found ' + result.routes.length + ' route(s) in ' + fileName);

  const newContent = generateDeclarativeRoutes(
    content,
    result.routes,
    result.middlewares,
    fileExt,
    options
  );

  await fs.outputFile(filePath, newContent);
  console.log('Migrated ' + fileName);
}

interface Route {
  method: string;
  path: string;
  middlewares: string[];
  handler: string;
}

function parseRoutes(content: string): { routes: Route[]; middlewares: string[] } {
  const routes: Route[] = [];
  const discoveredMiddlewares: string[] = [];

  const pattern = /router\.(\w+)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)\s*;?/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const method = match[1].toLowerCase();

    if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
      continue;
    }

    const routePath = match[2];
    const args = (match[3] || '')
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean)
      .map((arg) => arg.replace(/\([^)]*\)/g, '').trim())
      .filter(Boolean);

    if (args.length === 0) {
      continue;
    }

    const handler = args[args.length - 1];
    const middlewares = args.slice(0, -1);
    discoveredMiddlewares.push(...middlewares);

    routes.push({
      method,
      path: routePath,
      middlewares,
      handler
    });
  }

  const uniqueRoutes = routes.filter((route, index, self) =>
    index === self.findIndex(r => r.path === route.path && r.method === route.method)
  );

  const uniqueMiddlewares = Array.from(new Set(discoveredMiddlewares));

  return { routes: uniqueRoutes, middlewares: uniqueMiddlewares };
}

function generateDeclarativeRoutes(
  originalContent: string,
  routes: Route[],
  extractedMiddlewares: string[],
  fileExt: string,
  options: MigrationOptions
): string {
  const { defaultMiddleware, defaultRoles, hasAuth, hasAuditLogger, hasSourceSelection } = options;
  const isTS = fileExt === 'ts';

  const preservedImports = originalContent
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('import ')) {
        return false;
      }

      if (trimmed.includes("from 'express'") || trimmed.includes('from "express"')) {
        return false;
      }

      if (trimmed.includes("from '../config/router.js'") || trimmed.includes('from "../config/router.js"')) {
        return false;
      }

      return true;
    });

  const imports = [
    "import { Router } from 'express';",
    "import { createConfiguredRouter, METHODS } from '../config/router.js';",
    ...preservedImports
  ];

  const importsSection = imports.join('\n');

  const routeEntries = routes.map((route) => {
    const method = route.method.toUpperCase();
    const disabled = route.middlewares.length > 0
      ? `,\n    disabled: [${route.middlewares.map((middleware) => `'${middleware}'`).join(', ')}]`
      : '';

    return `  {
    method: METHODS.${method},
    path: '${route.path}',
    handler: ${route.handler}${disabled}
  }`;
  }).join(',\n');

  const middlewareListStr = defaultMiddleware.length > 0
    ? defaultMiddleware.map(m => "'" + m + "'").join(', ')
    : '';

  const rolesListStr = defaultRoles.length > 0
    ? defaultRoles.map(r => "'" + r + "'").join(', ')
    : '';

  const commentPrefix = isTS ? '/**' : '/**';
  const commentSuffix = isTS ? ' */' : ' */';

  return importsSection + `\n
export const router = Router();\n
${commentPrefix}
 * Default middlewares applied to all routes
 * Can be overridden per-route using disabled/enabled
${commentSuffix}
const defaultMiddlewares${isTS ? ': string[]' : ''} = [${middlewareListStr}];\n
${commentPrefix}
 * Default roles - empty means no role restriction
 * Can be overridden per-route using roles
${commentSuffix}
const defaultRoles${isTS ? ': string[]' : ''} = [${rolesListStr}];\n
${commentPrefix}
 * Declarative route definitions
 *
 * Controllers should return: { success: true, data: {...}, message: '...' }
 * Services can throw: new Error('msg') with optional .statusCode
 *
${commentSuffix}
const routes = [\n${routeEntries}\n];

\n${commentPrefix}
 * Apply routes with automatic response handling
 * - Controllers return objects → framework sends JSON with 200
 * - Services throw errors → framework sends JSON with statusCode
${commentSuffix}
const configuredRouter = createConfiguredRouter({\n  defaultMiddlewares,\n  defaultRoles,\n  routes\n});\n
configuredRouter.applyToExpress(router);\n`;
}
