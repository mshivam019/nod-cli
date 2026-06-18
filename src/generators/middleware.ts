import prompts from 'prompts';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { generateSharedRateLimit } from './rate-limit.js';
import { getProjectConfig, updateNodConfig } from '../utils/config.js';
import { DEPENDENCIES } from '../utils/dependencies.js';
import { RateLimitStore } from '../types/index.js';

interface AddMiddlewareOptions {
  nonInteractive?: boolean;
  type?: string;
  isDefault?: boolean;
  rateLimitStore?: Exclude<RateLimitStore, 'none'>;
}

export async function addMiddleware(name: string, preset?: AddMiddlewareOptions) {
  const defaults = {
    type: preset?.type || 'custom',
    isDefault: preset?.isDefault ?? false,
    rateLimitStore: preset?.rateLimitStore || 'postgres'
  };

  const response = preset?.nonInteractive
    ? defaults
    : preset?.type || preset?.isDefault !== undefined
      ? {
          type: preset.type || defaults.type,
          isDefault: preset.isDefault ?? defaults.isDefault,
          rateLimitStore: preset.rateLimitStore || defaults.rateLimitStore
        }
      : await prompts([
    {
      type: 'select',
      name: 'type',
      message: 'Middleware type:',
      choices: [
        { title: 'Request Logger', value: 'logger' },
        { title: 'Shared-store Rate Limiter', value: 'rateLimit' },
        { title: 'CORS', value: 'cors' },
        { title: 'Custom', value: 'custom' }
      ]
    },
    {
      type: (_prev, values) => values.type === 'rateLimit' ? 'select' : null,
      name: 'rateLimitStore',
      message: 'Rate limiter store:',
      choices: [
        { title: 'Postgres table (preferred)', value: 'postgres' },
        { title: 'Redis / ElastiCache', value: 'redis' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'isDefault',
      message: 'Apply as default middleware?',
      initial: false
    }
  ]);

  const projectRoot = process.cwd();
  await createMiddleware(projectRoot, name, {
    type: response.type || defaults.type,
    isDefault: response.isDefault ?? defaults.isDefault,
    rateLimitStore: response.rateLimitStore || defaults.rateLimitStore
  });
}

async function createMiddleware(projectRoot: string, name: string, config: any) {
  const isTypeScript = await fs.pathExists(path.join(projectRoot, 'tsconfig.json'));
  const ext = isTypeScript ? 'ts' : 'js';
  const middlewarePath = path.join(projectRoot, 'src/middleware', `${name}.${ext}`);
  
  // Detect framework
  const packageJson = JSON.parse(
    await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8')
  );
  const isHono = packageJson.dependencies?.hono;

  if (config.type === 'rateLimit') {
    const projectConfig = await getProjectConfig(projectRoot);
    const store = (config.rateLimitStore ||
      projectConfig?.components?.security?.rateLimitStore ||
      'postgres') as Exclude<RateLimitStore, 'none'>;

    if (store === 'postgres' && projectConfig?.orm !== 'drizzle' && !packageJson.dependencies?.['drizzle-orm']) {
      throw new Error('Postgres rate limiting requires Drizzle. Run `nod add drizzle` first or use `--rate-limit-store redis`.');
    }

    const tablePrefix = (projectConfig?.name || packageJson.name || 'app')
      .replace(/^@[^/]+\//, '')
      .split('-')[0]
      .replace(/[^a-zA-Z0-9_]/g, '_');
    await generateSharedRateLimit(projectRoot, ext, `${tablePrefix}_rate_limits`, store);

    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...(store === 'redis'
        ? {
            'rate-limiter-flexible': DEPENDENCIES.rateLimiterFlexible,
            ioredis: DEPENDENCIES.ioredis,
          }
        : {}),
    };
    await fs.writeJson(path.join(projectRoot, 'package.json'), packageJson, { spaces: 2 });

    if (projectConfig) {
      await updateNodConfig(projectRoot, {
        components: {
          ...projectConfig.components,
          security: {
            ...projectConfig.components?.security,
            rateLimitStore: store,
          },
        },
      } as any);
    }

    console.log(chalk.green(`✓ Created shared ${store} rate limiter: src/middleware/rateLimit.middleware.${ext}`));
    console.log(chalk.gray('  Import `rateLimiters` or `createRateLimitMiddleware` from `./middleware/rateLimit.middleware.js`.'));
    return;
  }

  let middlewareContent = '';

  if (isHono) {
    middlewareContent = generateHonoMiddleware(name, config.type);
  } else {
    middlewareContent = generateExpressMiddleware(name, config.type);
  }

  await fs.outputFile(middlewarePath, middlewareContent);
  console.log(chalk.green(`✓ Created middleware: ${middlewarePath}`));

  if (config.isDefault) {
    await addToDefaultMiddleware(projectRoot, name, isHono, ext);
  }
}

function generateExpressMiddleware(name: string, type: string): string {
  const templates: Record<string, string> = {
    logger: `import { Request, Response, NextFunction } from 'express';

export function ${name}Middleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${req.method}] \${req.path} - \${res.statusCode} (\${duration}ms)\`);
  });
  
  next();
}`,
    cors: `import { Request, Response, NextFunction } from 'express';

export function ${name}Middleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
}`,
    custom: `import { Request, Response, NextFunction } from 'express';

export function ${name}Middleware(req: Request, res: Response, next: NextFunction) {
  // TODO: Implement custom middleware logic
  console.log('${name} middleware executed');
  next();
}`
  };

  return templates[type] || templates.custom;
}

function generateHonoMiddleware(name: string, type: string): string {
  const templates: Record<string, string> = {
    logger: `import { Context, Next } from 'hono';

export async function ${name}Middleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(\`[\${c.req.method}] \${c.req.path} - \${c.res.status} (\${duration}ms)\`);
}`,
    cors: `import { Context, Next } from 'hono';

export async function ${name}Middleware(c: Context, next: Next) {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    c.text('', 200);
    return;
  }
  
  await next();
}`,
    custom: `import { Context, Next } from 'hono';

export async function ${name}Middleware(c: Context, next: Next) {
  // TODO: Implement custom middleware logic
  console.log('${name} middleware executed');
  await next();
}`
  };

  return templates[type] || templates.custom;
}

async function addToDefaultMiddleware(projectRoot: string, name: string, isHono: boolean, ext: 'ts' | 'js') {
  const appPath = path.join(projectRoot, `src/app.${ext}`);
  
  try {
    let content = await fs.readFile(appPath, 'utf-8');
    
    // Add import
    const importLine = `import { ${name}Middleware } from './middleware/${name}.js';`;
    if (!content.includes(importLine)) {
      const lastImport = content.lastIndexOf('import');
      const endOfLastImport = content.indexOf('\n', lastImport);
      content = content.slice(0, endOfLastImport + 1) + importLine + '\n' + content.slice(endOfLastImport + 1);
    }

    // Add middleware usage
    const useLine = isHono 
      ? `  app.use(${name}Middleware);`
      : `  app.use(${name}Middleware);`;
    
    if (!content.includes(useLine)) {
      const healthCheck = content.indexOf('app.get(\'/health\'');
      if (healthCheck !== -1) {
        content = content.slice(0, healthCheck) + useLine + '\n\n' + content.slice(healthCheck);
      }
    }

    await fs.outputFile(appPath, content);
    console.log(chalk.green(`✓ Added ${name} as default middleware`));
  } catch (error) {
    console.error(chalk.red('Failed to add default middleware:'), error);
  }
}
