import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';
import { generateExpressProject } from './frameworks/express.js';
import { generateHonoProject } from './frameworks/hono.js';
import { getTemplateContext } from '../utils/template.js';

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
  await generateGitIgnore(projectPath);
  await generateLogger(projectPath, ext);
  await generateDocsFolder(projectPath, config);
  await generateTempFolder(projectPath);
  
  if (config.features.docker !== false) {
    await generateDockerFiles(projectPath, config);
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
      await generateSupabaseJwtAuth(projectPath, ext);
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

  // Generate model/source config
  if (config.features.modelConfig) {
    const { generateModelConfig, generateSelectionMiddleware } = await import('./ai.js');
    await generateModelConfig(projectPath, ext);
    await generateSelectionMiddleware(projectPath, ext, true, false); // model=true, source=false
  }

  if (config.features.sourceConfig) {
    const { generateSourceConfig, generateSourceSelectionMiddleware } = await import('./ai.js');
    await generateSourceConfig(projectPath, ext);
    await generateSourceSelectionMiddleware(projectPath, ext);
  }

  // Generate API audit middleware
  if (config.features.apiAudit) {
    const { generateApiAudit, generateAuditSchema } = await import('./audit.js');
    const auditTableName = `${config.name.replace(/-/g, '_')}_api_audit`;
    await generateApiAudit(projectPath, ext, auditTableName);
    await generateAuditSchema(projectPath, auditTableName);
  }
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
    'dotenv': '^16.3.1',
  };
  
  const devDependencies: Record<string, string> = {
    'nodemon': '^3.0.2',
    'eslint': '^8.55.0',
    'prettier': '^3.1.1',
  };

  if (config.typescript) {
    dependencies['zod'] = '^3.22.4';
    devDependencies['@types/node'] = '^20.10.0';
    devDependencies['typescript'] = '^5.3.3';
    devDependencies['tsx'] = '^4.7.0';
  }

  if (config.framework === 'express') {
    dependencies['express'] = '^4.18.2';
    dependencies['express-async-errors'] = '^3.1.1';
    dependencies['cors'] = '^2.8.5';
    dependencies['helmet'] = '^7.1.0';
    dependencies['morgan'] = '^1.10.0';
    if (config.typescript) {
      devDependencies['@types/express'] = '^4.17.21';
      devDependencies['@types/cors'] = '^2.8.17';
      devDependencies['@types/morgan'] = '^1.9.9';
    }
  } else if (config.framework === 'hono') {
    dependencies['hono'] = '^4.6.0';
    dependencies['@hono/node-server'] = '^1.13.0';
  }

  // Auth dependencies
  if (config.auth === 'jwt') {
    dependencies['jsonwebtoken'] = '^9.0.2';
    if (config.typescript) {
      devDependencies['@types/jsonwebtoken'] = '^9.0.5';
    }
  }

  if (config.auth === 'jwks') {
    dependencies['jsonwebtoken'] = '^9.0.2';
    dependencies['jwks-rsa'] = '^3.1.0';
    if (config.typescript) {
      devDependencies['@types/jsonwebtoken'] = '^9.0.5';
    }
  }

  if (config.auth === 'supabase') {
    dependencies['jose'] = '^5.2.0';
    dependencies['jsonwebtoken'] = '^9.0.2';
    if (config.typescript) {
      devDependencies['@types/jsonwebtoken'] = '^9.0.5';
    }
  }

  // Database dependencies
  if (config.database === 'pg') {
    dependencies['pg'] = '^8.11.3';
    if (config.typescript) {
      devDependencies['@types/pg'] = '^8.10.9';
    }
  } else if (config.database === 'mysql') {
    dependencies['mysql2'] = '^3.6.5';
  } else if (config.database === 'supabase') {
    dependencies['@supabase/supabase-js'] = '^2.39.0';
  }

  // ORM dependencies
  if (config.orm === 'drizzle') {
    dependencies['drizzle-orm'] = '^0.29.0';
    dependencies['postgres'] = '^3.4.0';
    devDependencies['drizzle-kit'] = '^0.20.0';
  }

  // Cron dependencies
  if (config.features.cron) {
    dependencies['node-cron'] = '^3.0.3';
    if (config.typescript) {
      devDependencies['@types/node-cron'] = '^3.0.11';
    }
  }

  // Queue dependencies
  if (config.queue === 'bull') {
    dependencies['bullmq'] = '^5.1.0';
    dependencies['ioredis'] = '^5.3.2';
  }

  // Logging
  dependencies['winston'] = '^3.11.0';

  // AI dependencies
  if (config.ai?.rag || config.ai?.chat) {
    dependencies['@langchain/openai'] = '^0.6.0';
    dependencies['@langchain/core'] = '^0.3.78';
    dependencies['langchain'] = '^0.3.27';
  }

  if (config.ai?.langfuse) {
    // Add langfuse-langchain for LLM observability
    // These versions are compatible with @langchain/core@^0.3.x
    dependencies['langfuse-langchain'] = '^3.37.0';
    
    // If langfuse is enabled but no RAG/chat, still need langchain core
    if (!config.ai?.rag && !config.ai?.chat) {
      dependencies['@langchain/core'] = '^0.3.78';
      dependencies['langchain'] = '^0.3.27';
    }
  }

  // PM2 for production
  devDependencies['pm2'] = '^5.3.0';

  if (config.features.testing) {
    devDependencies['vitest'] = '^1.0.4';
  }

  const ext = config.typescript ? 'ts' : 'js';
  const scripts: Record<string, string> = {
    dev: config.typescript 
      ? `tsx watch src/server.${ext}`
      : `nodemon src/server.${ext}`,
    build: config.typescript ? 'tsc' : 'echo "No build needed for JS"',
    start: config.typescript ? 'node dist/server.js' : `node src/server.${ext}`,
    'start:pm2': 'pm2 start ecosystem.config.js --env production',
    'stop:pm2': 'pm2 stop ecosystem.config.js',
    'restart:pm2': 'pm2 restart ecosystem.config.js',
    'logs:pm2': 'pm2 logs',
    'monit:pm2': 'pm2 monit',
    lint: 'eslint . --ext .ts,.js',
    format: 'prettier --write "src/**/*.{ts,js}"',
  };

  if (config.orm === 'drizzle') {
    scripts['db:generate'] = 'drizzle-kit generate';
    scripts['db:push'] = 'drizzle-kit push';
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
    main: config.typescript ? 'dist/server.js' : 'src/server.js',
    type: 'module',
    scripts,
    dependencies,
    devDependencies
  };

  await fs.outputFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
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
SUPABASE_API_KEY=your-service-role-key
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
OPENAI_API_KEY=sk-your-openai-api-key
`;
  }

  if (config.ai?.langfuse) {
    envContent += `
# Langfuse - Production
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key

# Langfuse - Staging
LANGFUSE_STAGING_PUBLIC_KEY=pk-lf-your-staging-public-key
LANGFUSE_STAGING_SECRET_KEY=sk-lf-your-staging-secret-key
`;
  }

  // Vercel Cron
  if (config.deployment?.vercelCron) {
    envContent += `
# Cron
CRON_SECRET=your-cron-secret-for-vercel
`;
  }

  // Model Config
  if (config.features.modelConfig) {
    envContent += `
# Model Domain Mapping (JSON)
MODEL_DOMAIN_MAPPING={"o3":"o3","mini":"gpt-4o-mini","default":"gpt-4o"}
`;
  }

  // Logging
  envContent += `
# Logging
LOG_LEVEL=info
`;

  await fs.outputFile(path.join(projectPath, '.env.example'), envContent);
}

async function generateTsConfig(projectPath: string, config: ProjectConfig) {
  if (!config.typescript) return;

  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      lib: ['ES2022'],
      moduleResolution: 'node',
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
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
\`\`\`

${config.orm === 'drizzle' ? `## Database Setup (Drizzle)

\`\`\`bash
# Generate migrations
npm run db:generate

# Push to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
\`\`\`
` : ''}

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm run lint\` - Lint code
- \`npm run format\` - Format code
${config.features.testing ? '- `npm test` - Run tests' : ''}
${config.orm === 'drizzle' ? `- \`npm run db:generate\` - Generate Drizzle migrations
- \`npm run db:push\` - Push schema to database
- \`npm run db:studio\` - Open Drizzle Studio` : ''}

## Project Structure

\`\`\`
src/
├── server.${config.typescript ? 'ts' : 'js'}      # Server entry point
├── app.${config.typescript ? 'ts' : 'js'}         # App composition
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
