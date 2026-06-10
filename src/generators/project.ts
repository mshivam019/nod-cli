import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';
import { generateExpressProject } from './frameworks/express.js';
import { generateHonoProject } from './frameworks/hono.js';
import { generateAgentsGuide } from './agents.js';
import { getTemplateContext } from '../utils/template.js';
import { createNodConfig, saveNodConfig } from '../utils/config.js';
import { DEPENDENCIES, DEV_DEPENDENCIES } from '../utils/dependencies.js';

function getProjectTablePrefix(projectName: string): string {
  const [firstSegment] = projectName.split('-');
  return firstSegment || projectName;
}

export async function generateProject(config: ProjectConfig) {
  const projectPath = path.join(process.cwd(), config.name);
  
  await fs.ensureDir(projectPath);

  // Create directory structure based on preset
  const structure = ['src/routes', 'src/controllers', 'src/services', 'src/config', 'src/helpers', 'src/utils', 'docs', 'temp'];

  if (config.preset !== 'minimal') {
    structure.push('src/middleware');
    
    // Only create auth folder for non-supabase auth (supabase auth uses middleware folder)
    if (config.auth !== 'none' && config.auth !== 'supabase') {
      structure.push('src/auth');
    }
    
    if (config.database !== 'none' || config.orm === 'drizzle') {
      structure.push('src/db');
    }
  }

  if (config.preset === 'full' || config.preset === 'ai' || config.features.cron) {
    structure.push('src/cron');
    structure.push('src/cron/jobs');
  }
  
  if (config.preset === 'full' && config.queue !== 'none') {
    structure.push('src/queue');
  }

  if (config.features.environments) {
    structure.push('src/environments');
  }

  if (config.typescript) {
    structure.push('src/types');
  }

  for (const dir of structure) {
    await fs.ensureDir(path.join(projectPath, dir));
  }

  // Generate framework-specific files
  const templateContext = getTemplateContext(config);
  const ext = templateContext.fileExt;
  
  if (config.framework === 'express') {
    await generateExpressProject(projectPath, config, templateContext);
  } else if (config.framework === 'hono') {
    await generateHonoProject(projectPath, config, templateContext);
  }
  
  // Generate common files
  await generateConfigFiles(projectPath, config, templateContext);
  await generatePackageJson(projectPath, config);
  await generateEnvFile(projectPath, config);
  await generateTsConfig(projectPath, config);
  await generatePrettierConfig(projectPath);
  await generateEslintConfig(projectPath, config);
  await generateGitIgnore(projectPath);
  await generateLogger(projectPath, ext);
  await generateDocsFolder(projectPath, config);
  await generateTempFolder(projectPath);
  
  // Generate nod.config.json for component generation context
  const nodConfig = createNodConfig(config);
  await saveNodConfig(projectPath, nodConfig);
  
  if (config.features.docker !== false) {
    await generateDockerFiles(projectPath, config);
  }

  if (config.features.security === 'strict' || config.auth === 'cookie-session' || config.auth === 'better-auth') {
    const { generateStrictSecurity } = await import('./security.js');
    await generateStrictSecurity(projectPath, config, ext);
  }

  if (config.deployment?.target === 'lambda-sam') {
    const { generateLambdaSam } = await import('./serverless.js');
    await generateLambdaSam(projectPath, config, ext);
  }
  
  await generateScripts(projectPath, config);
  
  // Generate PM2 configuration
  if (config.features.pm2 !== false) {
    const { generatePM2Config } = await import('./pm2.js');
    await generatePM2Config(projectPath, config);
  }
  
  // Generate lock adapter for cron jobs
  if (config.features.cron) {
    const { generateCronLocks } = await import('./cron-locks.js');
    const lockBackend = config.features.cronLock || 'file';
    await generateCronLocks(projectPath, lockBackend);
  }

  // Generate environment config
  if (config.features.environments) {
    const { generateEnvironments, generateEnvConfig } = await import('./environments.js');
    await generateEnvironments(projectPath, config, ext);
    await generateEnvConfig(projectPath, config, ext);
  }

  // Generate Supabase helper
  if (config.database === 'supabase' || config.auth === 'supabase') {
    const { generateSupabaseHelper, generateSupabaseJwtAuth } = await import('./supabase.js');
    await generateSupabaseHelper(projectPath, config, ext);
    
    if (config.auth === 'supabase') {
      await generateSupabaseJwtAuth(projectPath, ext, config.framework);
    }
  }

  // Generate Vercel cron
  if (config.deployment?.vercelCron) {
    const { generateVercelConfig, generateVercelCronRoutes, generateCronMiddleware, generateCronService } = await import('./vercel.js');
    await generateVercelConfig(projectPath, []);
    await generateVercelCronRoutes(projectPath, ext, config.framework);
    await generateCronMiddleware(projectPath, ext);
    await generateCronService(projectPath, ext);
  }

  // Generate GitHub workflow
  if (config.deployment?.githubWorkflow) {
    const { generateGithubWorkflow } = await import('./github.js');
    await generateGithubWorkflow(projectPath, { deployTrigger: true });
  }

  // Generate AI features
  if (config.ai?.rag) {
    const { generateRAGService } = await import('./ai.js');
    await generateRAGService(projectPath, config, ext);
  }

  if (config.ai?.chat) {
    const { generateChatService } = await import('./ai.js');
    await generateChatService(projectPath, config, ext);
  }

  if (config.ai?.langfuse) {
    const { generateLangfuseObservability } = await import('./observability.js');
    await generateLangfuseObservability(projectPath, config, ext);
  }

  // Generate API audit middleware
  if (config.features.apiAudit) {
    const { generateApiAudit, generateAuditSchema } = await import('./audit.js');
    const auditTableName = `${getProjectTablePrefix(config.name)}_api_audit`;
    await generateApiAudit(projectPath, ext, auditTableName);
    await generateAuditSchema(projectPath, auditTableName, config.orm === 'drizzle');
  }

  await generateAgentsGuide(projectPath, {
    mode: 'init',
    config
  });
}

async function generateLogger(projectPath: string, ext: string) {
  const loggerContent = `import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
`;

  await fs.outputFile(path.join(projectPath, `src/utils/logger.${ext}`), loggerContent);
}

async function generateConfigFiles(projectPath: string, config: ProjectConfig, ctx: any) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';

  if (config.features.environments) {
    const configIndexContent = `export { config, env } from './config.js';\nexport { default } from './config.js';\n`;
    await fs.outputFile(path.join(projectPath, `src/config/index.${ext}`), configIndexContent);
    return;
  }
  
  // Main config with zod validation (only for TS) or simple config for JS
  const configContent = isTS
    ? `import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.number().default(3000),
  env: z.enum(['development', 'production', 'test']).default('development'),
  ${ctx.hasAuth ? `jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('24h'),
    ${ctx.hasJWKS ? `jwksUri: z.string().url(),
    audience: z.string(),
    issuer: z.string(),` : ''}
  }),` : ''}
  ${ctx.hasDatabase ? `database: z.object({
    host: z.string(),
    port: z.number(),
    name: z.string(),
    user: z.string(),
    password: z.string(),
    pool: z.object({
      min: z.number().default(2),
      max: z.number().default(10),
    }),
  }),` : ''}
  ${ctx.hasLogging ? `logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),` : ''}
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  ${ctx.hasAuth ? `jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    ${ctx.hasJWKS ? `jwksUri: process.env.JWKS_URI!,
    audience: process.env.JWT_AUDIENCE!,
    issuer: process.env.JWT_ISSUER!,` : ''}
  },` : ''}
  ${ctx.hasDatabase ? `database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || ${config.database === 'pg' ? 5432 : 3306},
    name: process.env.DB_NAME || '${config.name}',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    pool: {
      min: Number(process.env.DB_POOL_MIN) || 2,
      max: Number(process.env.DB_POOL_MAX) || 10,
    },
  },` : ''}
  ${ctx.hasLogging ? `logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
  },` : ''}
});
`
    : `import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  ${ctx.hasAuth ? `jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    ${ctx.hasJWKS ? `jwksUri: process.env.JWKS_URI,
    audience: process.env.JWT_AUDIENCE,
    issuer: process.env.JWT_ISSUER,` : ''}
  },` : ''}
  ${ctx.hasDatabase ? `database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || ${config.database === 'pg' ? 5432 : 3306},
    name: process.env.DB_NAME || '${config.name}',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    pool: {
      min: Number(process.env.DB_POOL_MIN) || 2,
      max: Number(process.env.DB_POOL_MAX) || 10,
    },
  },` : ''}
  ${ctx.hasLogging ? `logging: {
    level: process.env.LOG_LEVEL || 'info',
  },` : ''}
};
`;

  await fs.outputFile(path.join(projectPath, `src/config/index.${ext}`), configContent);
}

async function generatePackageJson(projectPath: string, config: ProjectConfig) {
  const dependencies: Record<string, string> = {
    'dotenv': DEPENDENCIES.dotenv,
  };
  
  const devDependencies: Record<string, string> = {
    'nodemon': DEV_DEPENDENCIES.nodemon,
    'eslint': DEV_DEPENDENCIES.eslint,
    '@eslint/js': DEV_DEPENDENCIES.eslintJs,
    'prettier': DEV_DEPENDENCIES.prettier,
  };

  if (config.typescript || config.features.environments) {
    dependencies['zod'] = DEPENDENCIES.zod;
  }

  if (config.typescript) {
    devDependencies['@types/node'] = DEV_DEPENDENCIES.typesNode;
    devDependencies['typescript'] = DEV_DEPENDENCIES.typescript;
    devDependencies['tsx'] = DEV_DEPENDENCIES.tsx;
    devDependencies['@typescript-eslint/parser'] = DEV_DEPENDENCIES.typescriptEslintParser;
    devDependencies['@typescript-eslint/eslint-plugin'] = DEV_DEPENDENCIES.typescriptEslintPlugin;
  }

  if (config.framework === 'express') {
    dependencies['express'] = DEPENDENCIES.express;
    dependencies['cors'] = DEPENDENCIES.cors;
    dependencies['helmet'] = DEPENDENCIES.helmet;
    dependencies['morgan'] = DEPENDENCIES.morgan;
    if (config.features.security === 'strict' || config.auth === 'cookie-session' || config.auth === 'better-auth') {
      dependencies['cookie-parser'] = DEPENDENCIES.cookieParser;
    }
    if (config.typescript) {
      devDependencies['@types/express'] = DEV_DEPENDENCIES.typesExpress;
      devDependencies['@types/cors'] = DEV_DEPENDENCIES.typesCors;
      devDependencies['@types/morgan'] = DEV_DEPENDENCIES.typesMorgan;
      if (config.features.security === 'strict' || config.auth === 'cookie-session' || config.auth === 'better-auth') {
        devDependencies['@types/cookie-parser'] = DEV_DEPENDENCIES.typesCookieParser;
      }
    }
  } else if (config.framework === 'hono') {
    dependencies['hono'] = DEPENDENCIES.hono;
    dependencies['@hono/node-server'] = DEPENDENCIES.honoNodeServer;
  }

  // Auth dependencies
  if (config.auth === 'jwt') {
    dependencies['jsonwebtoken'] = DEPENDENCIES.jsonwebtoken;
    if (config.typescript) {
      devDependencies['@types/jsonwebtoken'] = DEV_DEPENDENCIES.typesJsonwebtoken;
    }
  }

  if (config.auth === 'jwks') {
    dependencies['jsonwebtoken'] = DEPENDENCIES.jsonwebtoken;
    dependencies['jwks-rsa'] = DEPENDENCIES.jwksRsa;
    if (config.typescript) {
      devDependencies['@types/jsonwebtoken'] = DEV_DEPENDENCIES.typesJsonwebtoken;
    }
  }

  if (config.auth === 'supabase') {
    dependencies['jose'] = DEPENDENCIES.jose;
  }

  if (config.auth === 'better-auth') {
    dependencies['better-auth'] = DEPENDENCIES.betterAuth;
    dependencies['bcryptjs'] = DEPENDENCIES.bcryptjs;
    if (config.typescript) {
      devDependencies['@types/bcryptjs'] = DEV_DEPENDENCIES.typesBcryptjs;
    }
  }

  // Database dependencies
  if (config.database === 'pg') {
    dependencies['pg'] = DEPENDENCIES.pg;
    if (config.typescript) {
      devDependencies['@types/pg'] = DEV_DEPENDENCIES.typesPg;
    }
  } else if (config.database === 'mysql') {
    dependencies['mysql2'] = DEPENDENCIES.mysql2;
  } else if (config.database === 'supabase') {
    dependencies['@supabase/supabase-js'] = DEPENDENCIES.supabase;
  }

  // ORM dependencies
  if (config.orm === 'drizzle') {
    dependencies['drizzle-orm'] = DEPENDENCIES.drizzleOrm;
    dependencies['postgres'] = DEPENDENCIES.postgres;
    devDependencies['drizzle-kit'] = DEV_DEPENDENCIES.drizzleKit;
  }

  // Cron dependencies
  if (config.features.cron) {
    dependencies['node-cron'] = DEPENDENCIES.nodeCron;
    if (config.typescript) {
      devDependencies['@types/node-cron'] = DEV_DEPENDENCIES.typesNodeCron;
    }
  }

  // Queue dependencies
  if (config.queue === 'bull') {
    dependencies['bullmq'] = DEPENDENCIES.bullmq;
    dependencies['ioredis'] = DEPENDENCIES.ioredis;
  }

  // Logging
  dependencies['winston'] = DEPENDENCIES.winston;

  // AI dependencies
  if (config.ai?.rag || config.ai?.chat) {
    dependencies['@langchain/core'] = DEPENDENCIES.langchainCore;
  }

  if (config.ai?.rag) {
    if ((config.ai.embeddings || 'openai') === 'openai') {
      dependencies['@langchain/openai'] = DEPENDENCIES.langchainOpenai;
    } else if (config.ai.embeddings === 'gemini') {
      dependencies['@langchain/google-genai'] = DEPENDENCIES.langchainGoogleGenai;
    } else if (config.ai.embeddings === 'cohere') {
      dependencies['@langchain/cohere'] = DEPENDENCIES.langchainCohere;
    }

    if ((config.ai.vectorStore || 'supabase') === 'supabase') {
      dependencies['@supabase/supabase-js'] = DEPENDENCIES.supabase;
    } else if (config.ai.vectorStore === 'pinecone') {
      dependencies['@pinecone-database/pinecone'] = DEPENDENCIES.pinecone;
      dependencies['@langchain/pinecone'] = DEPENDENCIES.langchainPinecone;
    } else if (config.ai.vectorStore === 'chroma') {
      dependencies['chromadb'] = DEPENDENCIES.chromadb;
      dependencies['@langchain/community'] = DEPENDENCIES.langchainCommunity;
    } else if (config.ai.vectorStore === 'weaviate') {
      dependencies['weaviate-ts-client'] = DEPENDENCIES.weaviate;
      dependencies['@langchain/weaviate'] = DEPENDENCIES.langchainWeaviate;
    }
  }

  if (config.ai?.chat) {
    if ((config.ai.llmProvider || 'openai') === 'openai') {
      dependencies['@langchain/openai'] = DEPENDENCIES.langchainOpenai;
    } else if (config.ai.llmProvider === 'anthropic') {
      dependencies['@langchain/anthropic'] = DEPENDENCIES.langchainAnthropic;
    } else if (config.ai.llmProvider === 'gemini') {
      dependencies['@langchain/google-genai'] = DEPENDENCIES.langchainGoogleGenai;
    }
  }

  if (config.ai?.langfuse) {
    dependencies['@langfuse/core'] = DEPENDENCIES.langfuseCore;
    dependencies['@langfuse/otel'] = DEPENDENCIES.langfuseOtel;
    dependencies['@opentelemetry/sdk-node'] = DEPENDENCIES.opentelemetrySdkNode;
  }

  if (config.features.pm2) {
    devDependencies['pm2'] = DEV_DEPENDENCIES.pm2;
  }

  if (config.features.testing) {
    devDependencies['vitest'] = DEV_DEPENDENCIES.vitest;
  }

  if (config.deployment?.target === 'lambda-sam') {
    dependencies['serverless-http'] = DEPENDENCIES.serverlessHttp;
    if (config.typescript) {
      devDependencies['tsup'] = DEV_DEPENDENCIES.tsup;
    }
  }

  const ext = config.typescript ? 'ts' : 'js';
  const drizzleConfigFile = config.typescript ? 'drizzle.config.ts' : 'drizzle.config.js';
  const entryBaseName = 'server';
  const isLambdaSam = config.deployment?.target === 'lambda-sam';
  const scripts: Record<string, string> = {
    dev: config.typescript 
      ? `tsx watch src/${entryBaseName}.${ext}`
      : `nodemon src/${entryBaseName}.${ext}`,
    build: config.typescript ? (isLambdaSam ? 'tsup' : 'tsc') : 'echo "No build needed for JS"',
    start: config.typescript ? `node dist/server.js` : `node src/server.${ext}`,
    lint: 'eslint . --ext .ts,.js',
    format: 'prettier --write "src/**/*.{ts,js}"',
  };

  if (isLambdaSam) {
    scripts.typecheck = 'tsc --noEmit';
    scripts['sam:build'] = 'pnpm build && sam build';
    scripts['sam:deploy:staging'] = 'sam deploy --config-env staging';
    scripts['sam:deploy:production'] = 'sam deploy --config-env production';
  }

  if (config.features.pm2) {
    scripts['start:pm2'] = 'pm2 start ecosystem.config.js --env production';
    scripts['stop:pm2'] = 'pm2 stop ecosystem.config.js';
    scripts['restart:pm2'] = 'pm2 restart ecosystem.config.js';
    scripts['logs:pm2'] = 'pm2 logs';
    scripts['monit:pm2'] = 'pm2 monit';
  }

  if (config.orm === 'drizzle') {
    scripts['db:generate'] = `drizzle-kit generate --config=${drizzleConfigFile}`;
    scripts['db:migrate'] = `drizzle-kit migrate --config=${drizzleConfigFile}`;
    scripts['db:studio'] = 'drizzle-kit studio';
  }

  if (config.features.testing) {
    scripts.test = 'vitest run';
    scripts['test:watch'] = 'vitest';
  }

  const packageJson = {
    name: config.name,
    version: '1.0.0',
    description: `Backend project generated with nod-cli`,
    main: config.typescript ? `dist/${entryBaseName}.js` : `src/${entryBaseName}.js`,
    type: 'module',
    packageManager: 'pnpm@10.27.0',
    scripts,
    dependencies,
    devDependencies,
    ...(isLambdaSam ? {
      overrides: {
        esbuild: '^0.28.0',
      },
      engines: {
        node: '22.x',
      },
    } : {}),
  };

  await fs.outputFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  if (isLambdaSam) {
    await fs.outputFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:
  - .

overrides:
  esbuild: ^0.28.0
`
    );
  }
}

async function generateEnvFile(projectPath: string, config: ProjectConfig) {
  let envContent = `# Server
PORT=3000
NODE_ENV=development
`;

  // Auth
  if (config.auth === 'jwt') {
    envContent += `
# JWT Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=24h
`;
  }

  if (config.auth === 'cookie-session') {
    envContent += `
# Cookie Session Authentication
SESSION_SECRET=your-session-secret-change-this-in-production-min-32-chars
`;
  }

  if (config.auth === 'better-auth') {
    envContent += `
# Better Auth
BACKEND_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-better-auth-secret-min-32-chars
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173
`;
  }

  if (config.auth === 'jwks') {
    envContent += `
# JWKS Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
JWKS_URI=https://your-auth-provider.com/.well-known/jwks.json
JWT_AUDIENCE=your-api-audience
JWT_ISSUER=https://your-auth-provider.com/
`;
  }

  // Database
  if (config.database === 'pg' || config.database === 'mysql') {
    const defaultPort = config.database === 'pg' ? 5432 : 3306;
    envContent += `
# Database
DB_HOST=localhost
DB_PORT=${defaultPort}
DB_NAME=${config.name}
DB_USER=root
DB_PASSWORD=
DB_POOL_MIN=2
DB_POOL_MAX=10
`;
  }

  // Supabase
  if (config.database === 'supabase' || config.auth === 'supabase') {
    envContent += `
# Supabase - Production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT=your-project-id
`;

    if (config.orm === 'drizzle' || config.supabase?.usePooler) {
      envContent += `SUPABASE_POOLER_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres
`;
    }

    envContent += `
# Supabase - Staging
SUPABASE_STAGING_URL=https://your-staging-project.supabase.co
SUPABASE_STAGING_SECRET_KEY=your-staging-service-role-key
SUPABASE_STAGING_ANON_KEY=your-staging-anon-key
SUPABASE_STAGING_PROJECT=your-staging-project-id
`;

    if (config.orm === 'drizzle' || config.supabase?.usePooler) {
      envContent += `SUPABASE_STAGING_POOLER_URL=postgresql://postgres.your-staging-project:password@aws-0-region.pooler.supabase.com:6543/postgres
`;
    }
  }

  // Queue
  if (config.queue === 'bull') {
    envContent += `
# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
`;
  }

  // AI Features
  if (config.ai?.rag || config.ai?.chat) {
    envContent += `
# OpenAI
OPENAI_API_KEY=replace-with-openai-api-key
`;
  }

  if (config.ai?.langfuse) {
    envContent += `
# Langfuse - Production
LANGFUSE_PUBLIC_KEY=replace-with-langfuse-public-key
LANGFUSE_SECRET_KEY=replace-with-langfuse-secret-key

# Langfuse - Staging
LANGFUSE_STAGING_PUBLIC_KEY=replace-with-langfuse-staging-public-key
LANGFUSE_STAGING_SECRET_KEY=replace-with-langfuse-staging-secret-key
`;
  }

  // Vercel Cron
  if (config.deployment?.vercelCron) {
    envContent += `
# Cron
CRON_SECRET=your-cron-secret-for-vercel
`;
  }

  // Logging
  envContent += `
# Logging
LOG_LEVEL=info
`;

  if (config.features.security === 'strict' || config.auth === 'cookie-session' || config.auth === 'better-auth') {
    envContent += `
# Strict Security
TRUSTED_PARENT_DOMAINS=localhost
ORIGIN_VERIFY_SECRET=
JSON_BODY_LIMIT=256kb
MAX_BODY_BYTES=262144
URLENCODED_BODY_LIMIT=32kb
URLENCODED_PARAMETER_LIMIT=100
`;
  }

  await fs.outputFile(path.join(projectPath, '.env.example'), envContent);
}

async function generateTsConfig(projectPath: string, config: ProjectConfig) {
  if (!config.typescript) return;

  const isLambdaSam = config.deployment?.target === 'lambda-sam';
  const tsConfig = isLambdaSam ? {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      types: ['node'],
      strict: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      moduleDetection: 'force',
      noEmit: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true
    },
    include: ['src/**/*.ts', 'src/**/*.d.ts', 'tsup.config.ts'],
    exclude: ['node_modules', 'dist', '.aws-sam']
  } : {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      lib: ['ES2022'],
      moduleResolution: 'node',
      types: ['node'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };

  await fs.outputFile(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
}

async function generateGitIgnore(projectPath: string) {
  const gitignore = `node_modules/
dist/
*.log
.env
.DS_Store
coverage/
.vscode/
.idea/

# Temp output folder
temp/
`;

  await fs.outputFile(path.join(projectPath, '.gitignore'), gitignore);
}

async function generatePrettierConfig(projectPath: string) {
  const prettierConfig = {
    tabWidth: 4,
    useTabs: false
  };

  await fs.outputFile(
    path.join(projectPath, '.prettierrc.json'),
    JSON.stringify(prettierConfig, null, 4)
  );
}

async function generateEslintConfig(projectPath: string, config: ProjectConfig) {
  const content = config.typescript
    ? `import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'drizzle/**'],
    },
    {
        ...js.configs.recommended,
        files: ['**/*.js'],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: 'module',
            },
            globals: {
                process: 'readonly',
                console: 'readonly',
                URL: 'readonly',
                Buffer: 'readonly',
                Blob: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-useless-catch': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
];
`
    : `import js from '@eslint/js';

export default [
    {
        ignores: ['node_modules/**'],
    },
    {
        ...js.configs.recommended,
        languageOptions: {
            globals: {
                process: 'readonly',
                console: 'readonly',
                URL: 'readonly',
                Buffer: 'readonly',
                Blob: 'readonly',
            },
        },
        rules: {
            'no-useless-catch': 'off',
        },
    },
];
`;

  await fs.outputFile(path.join(projectPath, 'eslint.config.js'), content);
}

async function generateDocsFolder(projectPath: string, config: ProjectConfig) {
  const readmeContent = `# ${config.name} Documentation

This folder contains project documentation, plans, and instructions.

## Structure

- \`README.md\` - This file
- \`architecture.md\` - System architecture and design decisions
- \`api.md\` - API documentation
- \`setup.md\` - Setup and deployment instructions

## Getting Started

Add your project documentation here. Consider including:

- Project requirements and specifications
- Architecture diagrams and decisions
- API endpoint documentation
- Development workflow and guidelines
- Deployment procedures
`;

  await fs.outputFile(path.join(projectPath, 'docs/README.md'), readmeContent);
}

async function generateTempFolder(projectPath: string) {
  const gitkeepContent = `# Temp Output Folder

This folder is for temporary output files (PDFs, exports, generated files, etc.).

**Note:** This folder is git-ignored. Files here will not be committed.
`;

  await fs.outputFile(path.join(projectPath, 'temp/.gitkeep'), gitkeepContent);
}

async function generateDockerFiles(projectPath: string, config: ProjectConfig) {
  const dockerfile = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY ${config.typescript ? 'dist' : 'src'} ./${config.typescript ? 'dist' : 'src'}

EXPOSE 3000

CMD ["npm", "start"]
`;

  await fs.outputFile(path.join(projectPath, 'Dockerfile'), dockerfile);

  if (config.queue === 'bull' || config.database !== 'none') {
    const composeServices: any = {};

    if (config.database === 'pg') {
      composeServices.postgres = {
        image: 'postgres:16-alpine',
        environment: {
          POSTGRES_DB: config.name,
          POSTGRES_USER: 'root',
          POSTGRES_PASSWORD: 'password'
        },
        ports: ['5432:5432'],
        volumes: ['postgres_data:/var/lib/postgresql/data']
      };
    }

    if (config.queue === 'bull') {
      composeServices.redis = {
        image: 'redis:7-alpine',
        ports: ['6379:6379'],
        volumes: ['redis_data:/data']
      };
    }

    const compose = {
      version: '3.8',
      services: composeServices,
      volumes: Object.keys(composeServices).reduce((acc: any, key) => {
        acc[`${key}_data`] = {};
        return acc;
      }, {})
    };

    await fs.outputFile(
      path.join(projectPath, 'docker-compose.yml'),
      JSON.stringify(compose, null, 2)
    );
  }
}

async function generateScripts(projectPath: string, config: ProjectConfig) {
  const drizzleConfigFile = config.typescript ? 'drizzle.config.ts' : 'drizzle.config.js';
  const entryStructure = config.framework === 'express'
    ? `├── app.${config.typescript ? 'ts' : 'js'}         # App entry point`
    : `├── server.${config.typescript ? 'ts' : 'js'}      # Server entry point\n├── app.${config.typescript ? 'ts' : 'js'}         # App composition`;

  // Add README
  const readme = `# ${config.name}

Backend project generated with nod-cli

## Features

- Framework: ${config.framework}
- Language: ${config.typescript ? 'TypeScript' : 'JavaScript'}
- Database: ${config.database}
- Auth: ${config.auth}
${config.orm === 'drizzle' ? '- ORM: Drizzle' : ''}
${config.queue !== 'none' ? `- Queue: ${config.queue}` : ''}
${config.features.cron ? '- Cron jobs' : ''}
${config.features.environments ? '- Environment config (staging/production)' : ''}
${config.ai?.rag ? '- RAG (Retrieval Augmented Generation)' : ''}
${config.ai?.chat ? '- Chat service' : ''}
${config.ai?.langfuse ? '- Langfuse LLM observability' : ''}
${config.deployment?.vercelCron ? '- Vercel cron' : ''}
${config.deployment?.githubWorkflow ? '- GitHub workflow' : ''}

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
\`\`\`

${config.orm === 'drizzle' ? `## Database Setup (Drizzle)

\`\`\`bash
# Generate migrations
pnpm db:generate

# Apply migrations
pnpm exec drizzle-kit migrate --config=${drizzleConfigFile}

# Open Drizzle Studio
pnpm db:studio
\`\`\`
` : ''}

## Scripts

- \`pnpm dev\` - Start development server
- \`pnpm build\` - Build for production
- \`pnpm start\` - Start production server
- \`pnpm lint\` - Lint code
- \`pnpm format\` - Format code
${config.features.testing ? '- `pnpm test` - Run tests' : ''}
${config.orm === 'drizzle' ? `- \`pnpm db:generate\` - Generate Drizzle migrations
- \`pnpm exec drizzle-kit migrate --config=${drizzleConfigFile}\` - Apply Drizzle migrations
- \`pnpm db:migrate\` - Apply Drizzle migrations
- \`pnpm db:studio\` - Open Drizzle Studio` : ''}

## Project Structure

\`\`\`
src/
${entryStructure}
├── routes/          # Route definitions
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Custom middleware
├── helpers/         # Utility functions
├── utils/           # Utility modules
├── config/          # Configuration
${config.database !== 'none' || config.orm === 'drizzle' ? '├── db/             # Database connection & schema' : ''}
${config.features.environments ? '├── environments/   # Environment configs (staging/production)' : ''}
${config.features.cron ? '├── cron/           # Scheduled jobs' : ''}
${config.typescript ? '└── types/          # TypeScript types' : ''}
\`\`\`

${config.deployment?.vercelCron ? `## Vercel Cron

Add cron jobs to \`vercel.json\`:

\`\`\`json
{
  "crons": [
    {
      "path": "/cron/your-job",
      "schedule": "0 3 * * *"
    }
  ]
}
\`\`\`

Set \`CRON_SECRET\` in Vercel environment variables.
` : ''}

${config.ai?.rag || config.ai?.chat ? `## AI Features

${config.ai?.rag ? `### RAG Service
Use \`ragService\` for vector similarity search and document retrieval.
` : ''}
${config.ai?.chat ? `### Chat Service
Use \`chatService\` for conversation management and AI responses.
` : ''}
${config.ai?.langfuse ? `### Langfuse
LLM calls are automatically traced with Langfuse. Set your keys in \`.env\`.
` : ''}
` : ''}
`;

  await fs.outputFile(path.join(projectPath, 'README.md'), readme);
}
