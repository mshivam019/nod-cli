import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

export async function generateLambdaSam(projectPath: string, config: ProjectConfig, ext: string) {
  if (config.framework !== 'express') {
    return;
  }

  const isTS = ext === 'ts';
  const hasLangfuse = Boolean(config.ai?.langfuse);
  const lambdaContent = isTS
    ? `import serverless from 'serverless-http';
import { createApp } from './app.js';
${hasLangfuse ? "import { initializeTelemetry } from './instrumentation.js';\n" : ''}import logger from './utils/logger.js';

const lambdaHandler = serverless(createApp());

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    ${hasLangfuse ? 'await initializeTelemetry();\n    ' : ''}return await lambdaHandler(event, context);
  } catch (error) {
    logger.error('Lambda request failed.', {
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    throw error;
  }
};
`
    : `import serverless from 'serverless-http';
import { createApp } from './app.js';
${hasLangfuse ? "import { initializeTelemetry } from './instrumentation.js';\n" : ''}import logger from './utils/logger.js';

const lambdaHandler = serverless(createApp());

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    ${hasLangfuse ? 'await initializeTelemetry();\n    ' : ''}return await lambdaHandler(event, context);
  } catch (error) {
    logger.error('Lambda request failed.', {
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    throw error;
  }
};
`;

  await fs.outputFile(path.join(projectPath, `src/lambda.${ext}`), lambdaContent);
  if (config.features.cron) {
    await fs.outputFile(path.join(projectPath, `src/cron-lambda.${ext}`), generateCronLambda(config, isTS));
  }

  if (isTS) {
    await fs.outputFile(path.join(projectPath, 'scripts/build-lambda.mjs'), generateLambdaBuildScript());
    await fs.outputFile(path.join(projectPath, 'scripts/check-sam-runtime-imports.mjs'), generateSamRuntimeImportCheckScript());
    await fs.outputFile(path.join(projectPath, 'scripts/require-codebuild-deploy.mjs'), generateRequireCodeBuildDeployScript());
  }

  await fs.outputFile(path.join(projectPath, 'template.yaml'), generateSamTemplate(config));
  await fs.outputFile(path.join(projectPath, 'samconfig.toml'), generateSamConfig(config));
  await fs.outputFile(path.join(projectPath, 'docs/aws-sam-setup.md'), generateSamSetupDocs(config));
}

function generateLambdaBuildScript(): string {
  return `import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

const candidateEntries = {
  server: 'src/server.ts',
  lambda: 'src/lambda.ts',
  'cron-lambda': 'src/cron-lambda.ts',
  'appsync-authorizer': 'src/appsync-authorizer.ts',
  'stream-chat-lambda': 'src/stream-chat-lambda.ts',
};

const entryPoints = Object.fromEntries(
  Object.entries(candidateEntries).filter(([, entryPath]) => existsSync(entryPath)),
);

if (!entryPoints.lambda) {
  throw new Error('Missing required Lambda entry point: src/lambda.ts');
}

await rm('dist', { recursive: true, force: true });

await build({
  entryPoints,
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  sourcemap: false,
  splitting: false,
  logLevel: 'info',
  banner: {
    js: [
      "import { createRequire } from 'node:module';",
      "import { fileURLToPath as __nodeFileURLToPath } from 'node:url';",
      "import { dirname as __nodeDirname } from 'node:path';",
      'const require = createRequire(import.meta.url);',
      'const __filename = __nodeFileURLToPath(import.meta.url);',
      'const __dirname = __nodeDirname(__filename);',
    ].join('\\n'),
  },
});
`;
}

function generateCronLambda(_config: ProjectConfig, isTS: boolean): string {
  return isTS
    ? `import logger from './utils/logger.js';

type CronEvent = {
  job?: string;
  source?: string;
};

const runScheduledJob = async (job: string) => {
  // Replace this switch with direct service calls for each scheduled job.
  // Keep cron work out of request handlers so retries and timeouts are explicit.
  switch (job) {
    case 'daily-task':
      logger.info('Running daily scheduled task.');
      return { ok: true, job };
    default:
      throw new Error(\`Unknown cron job: \${job}\`);
  }
};

export const handler = async (event: CronEvent = {}) => {
  const job = event.job || 'daily-task';

  try {
    logger.info('Scheduled cron Lambda started.', { job, source: event.source });
    const result = await runScheduledJob(job);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Scheduled cron Lambda failed.', {
      job,
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    throw error;
  }
};
`
    : `import logger from './utils/logger.js';

const runScheduledJob = async (job) => {
  // Replace this switch with direct service calls for each scheduled job.
  // Keep cron work out of request handlers so retries and timeouts are explicit.
  switch (job) {
    case 'daily-task':
      logger.info('Running daily scheduled task.');
      return { ok: true, job };
    default:
      throw new Error(\`Unknown cron job: \${job}\`);
  }
};

export const handler = async (event = {}) => {
  const job = event.job || 'daily-task';

  try {
    logger.info('Scheduled cron Lambda started.', { job, source: event.source });
    const result = await runScheduledJob(job);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Scheduled cron Lambda failed.', {
      job,
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    throw error;
  }
};
`;
}

function generateSamRuntimeImportCheckScript(): string {
  return `import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const buildRoot = path.resolve('.aws-sam', 'build');
const templatePath = path.join(buildRoot, 'template.yaml');

const defaultEnv = {
  AUTH_JWT_AUDIENCE: 'sam-runtime-import-check',
  AUTH_JWT_ISSUER: 'sam-runtime-import-check',
  BACKEND_URL: 'https://example.invalid',
  BETTER_AUTH_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  CORS_ALLOWED_ORIGINS: 'https://example.invalid',
  CRON_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  JWT_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  LOG_LEVEL: 'error',
  NODE_ENV: 'test',
  OPENAI_API_KEY: 'sam-runtime-import-check',
  PORT: '3000',
  SESSION_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  SUPABASE_ANON_KEY: 'sam-runtime-import-check',
  SUPABASE_POOLER_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  SUPABASE_PROJECT: 'sam-runtime-import-check',
  SUPABASE_SECRET_KEY: 'sam-runtime-import-check',
  SUPABASE_STAGING_ANON_KEY: 'sam-runtime-import-check',
  SUPABASE_STAGING_POOLER_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  SUPABASE_STAGING_PROJECT: 'sam-runtime-import-check',
  SUPABASE_STAGING_SECRET_KEY: 'sam-runtime-import-check',
  SUPABASE_STAGING_URL: 'https://example.invalid',
  SUPABASE_URL: 'https://example.invalid',
};

for (const [key, value] of Object.entries(defaultEnv)) {
  process.env[key] ??= value;
}

globalThis.awslambda ??= {
  streamifyResponse: (handler) => handler,
};

if (!existsSync(templatePath)) {
  throw new Error('Missing .aws-sam/build/template.yaml. Run sam build first.');
}

const lines = readFileSync(templatePath, 'utf8').split(/\\r?\\n/);
const checks = [];
let resource = null;
let inProperties = false;
let codeUri = null;

for (const line of lines) {
  const resourceMatch = line.match(/^  ([A-Za-z0-9]+):\\s*$/);
  if (resourceMatch) {
    resource = resourceMatch[1];
    inProperties = false;
    codeUri = null;
    continue;
  }

  if (!resource) continue;
  if (/^    Properties:\\s*$/.test(line)) {
    inProperties = true;
    continue;
  }
  if (!inProperties) continue;

  const codeUriMatch = line.match(/^      CodeUri:\\s+(.+?)\\s*$/);
  if (codeUriMatch) {
    codeUri = codeUriMatch[1].replace(/^['"]|['"]$/g, '');
    continue;
  }

  const handlerMatch = line.match(/^      Handler:\\s+(.+?)\\s*$/);
  if (!handlerMatch || !codeUri) continue;

  const handler = handlerMatch[1].replace(/^['"]|['"]$/g, '');
  const handlerParts = handler.split('.');
  const exportName = handlerParts.at(-1);
  const modulePath = handlerParts.slice(0, -1).join('.');
  const functionDir = path.join(buildRoot, codeUri);
  checks.push({
    resource,
    handler,
    exportName,
    candidates: [
      path.join(functionDir, \`\${modulePath}.mjs\`),
      path.join(functionDir, \`\${modulePath}.js\`),
      path.join(functionDir, \`\${modulePath}.cjs\`),
    ],
  });
}

const failures = [];

for (const [index, check] of checks.entries()) {
  const filePath = check.candidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    failures.push(\`\${check.resource} Handler=\${check.handler} missing handler file\`);
    continue;
  }

  try {
    const moduleUrl = \`\${pathToFileURL(filePath).href}?sam-runtime-import-check=\${index}\`;
    const moduleExports = await import(moduleUrl);
    if (!(check.exportName in moduleExports)) {
      failures.push(\`\${check.resource} Handler=\${check.handler} missing export "\${check.exportName}" in \${filePath}\`);
    }
  } catch (error) {
    failures.push(\`\${check.resource} Handler=\${check.handler} failed to import \${filePath}: \${error.stack || error.message}\`);
  }
}

if (failures.length > 0) {
  throw new Error(\`SAM runtime import check failed:\\n\${failures.join('\\n\\n')}\`);
}

console.log(\`Verified \${checks.length} SAM handler file(s) import successfully.\`);
`;
}

function generateRequireCodeBuildDeployScript(): string {
  return `const target = process.argv[2] || 'deployment';

if (process.env.CODEBUILD_BUILD_ID || process.env.ALLOW_LOCAL_SAM_DEPLOY === 'true') {
  process.exit(0);
}

console.error(
  [
    \`Blocked \${target} deploy outside AWS CodeBuild.\`,
    'Deploy through CodeBuild/CodePipeline so the deployed artifact always matches a Git commit.',
    'For emergency break-glass only, rerun with ALLOW_LOCAL_SAM_DEPLOY=true.',
  ].join('\\n')
);

process.exit(1);
`;
}

function generateSamTemplate(config: ProjectConfig): string {
  const secretVars = buildSecretEnvironmentVariables(config);
  const secretEnvBlock = secretVars.map(({ name, key }) => `        ${name}: !Sub '{{resolve:secretsmanager:\${AppConfigSecretArn}:SecretString:${key}}}'`).join('\n');
  const apiPolicies = buildApiPolicyStatements(config);
  const cronResource = config.features.cron ? `
  ScheduledCronFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: cron-lambda.handler
      Description: ${config.name} scheduled cron worker.
      Timeout: 900
      Policies:
        - AWSLambdaBasicExecutionRole
        - AWSXRayDaemonWriteAccess
${apiPolicies}
      Events:
        DailyTaskSchedule:
          Type: Schedule
          Properties:
            Schedule: 'cron(0 3 * * ? *)'
            Enabled: true
            Input: '{"job":"daily-task"}'
` : '';
  const langfuseRuntimeEnvBlock = config.ai?.langfuse
    ? `        LANGCHAIN_CALLBACKS_BACKGROUND: 'false'
        LANGFUSE_FLUSH_AT: '1'
        LANGFUSE_TRACING_ENVIRONMENT: !Ref Environment
`
    : '';

  return `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: ${config.name} backend on AWS Lambda and API Gateway.

Parameters:
  Environment:
    Type: String
    Default: staging
    AllowedValues:
      - staging
      - production
  VpcSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Private subnet IDs that can reach the database or private dependencies.
  LambdaSecurityGroupIds:
    Type: List<AWS::EC2::SecurityGroup::Id>
    Description: Security group IDs attached to Lambda network interfaces.
  AppConfigSecretArn:
    Type: String
    Description: Secrets Manager secret ARN with app runtime configuration.
  AppConfigSecretVersion:
    Type: String
    Default: ''
    Description: Current app secret version id. Updating this forces Lambda environment dynamic references to refresh.
  BackendUrl:
    Type: String
    Default: ''
    Description: Public API base URL after deployment.
  TrustedParentDomains:
    Type: String
    Default: localhost
    Description: Comma-separated parent domains accepted by strict CORS/origin checks.
  AuthJwtIssuer:
    Type: String
    Default: ''
    Description: Optional JWT issuer for shared auth tokens.
  AuthJwtAudience:
    Type: String
    Default: ''
    Description: Optional JWT audience for shared auth tokens.

Conditions:
  HasAuthJwtIssuer: !Not [!Equals [!Ref AuthJwtIssuer, '']]
  HasAuthJwtAudience: !Not [!Equals [!Ref AuthJwtAudience, '']]

Globals:
  Function:
    Runtime: nodejs22.x
    Architectures:
      - arm64
    MemorySize: 1024
    Timeout: 30
    Tracing: Active
    VpcConfig:
      SecurityGroupIds: !Ref LambdaSecurityGroupIds
      SubnetIds: !Ref VpcSubnetIds
    Environment:
      Variables:
        NODE_ENV: !Ref Environment
        APP_CONFIG_SECRET_VERSION: !Ref AppConfigSecretVersion
        PORT: '3000'
        BACKEND_URL: !Ref BackendUrl
        TRUSTED_PARENT_DOMAINS: !Ref TrustedParentDomains
        CORS_ALLOW_LOCALHOST: 'false'
        AUTH_JWT_ISSUER: !If [HasAuthJwtIssuer, !Ref AuthJwtIssuer, !Ref AWS::NoValue]
        AUTH_JWT_AUDIENCE: !If [HasAuthJwtAudience, !Ref AuthJwtAudience, !Ref AWS::NoValue]
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
${langfuseRuntimeEnvBlock}${secretEnvBlock}

Resources:
  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Environment

  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: lambda.handler
      Description: ${config.name} Express API.
      Timeout: 480
      Events:
        ProxyApi:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /{proxy+}
            Method: ANY
        RootApi:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /
            Method: ANY
      Policies:
        - AWSLambdaBasicExecutionRole
        - AWSXRayDaemonWriteAccess
${apiPolicies}
${cronResource}

Outputs:
  ApiUrl:
    Description: HTTP API endpoint.
    Value: !Sub 'https://\${HttpApi}.execute-api.\${AWS::Region}.amazonaws.com/\${Environment}'
`;
}

function buildSecretEnvironmentVariables(config: ProjectConfig): Array<{ name: string; key: string }> {
  const vars: Array<{ name: string; key: string }> = [
    { name: 'LOG_LEVEL', key: 'LOG_LEVEL' },
  ];

  if (config.auth === 'cookie-session') {
    vars.push({ name: 'SESSION_SECRET', key: 'SESSION_SECRET' });
  }

  if (config.auth === 'better-auth') {
    vars.push({ name: 'BETTER_AUTH_SECRET', key: 'BETTER_AUTH_SECRET' });
  }

  if (config.auth === 'jwt' || config.auth === 'jwks') {
    vars.push({ name: 'JWT_SECRET', key: 'JWT_SECRET' });
  }

  if (config.database === 'supabase' || config.auth === 'supabase') {
    vars.push(
      { name: 'SUPABASE_URL', key: 'SUPABASE_URL' },
      { name: 'SUPABASE_SECRET_KEY', key: 'SUPABASE_SECRET_KEY' },
      { name: 'SUPABASE_ANON_KEY', key: 'SUPABASE_ANON_KEY' },
      { name: 'SUPABASE_PROJECT', key: 'SUPABASE_PROJECT' },
      { name: 'SUPABASE_STAGING_URL', key: 'SUPABASE_URL' },
      { name: 'SUPABASE_STAGING_SECRET_KEY', key: 'SUPABASE_SECRET_KEY' },
      { name: 'SUPABASE_STAGING_ANON_KEY', key: 'SUPABASE_ANON_KEY' },
      { name: 'SUPABASE_STAGING_PROJECT', key: 'SUPABASE_PROJECT' },
    );
  }

  if (config.orm === 'drizzle') {
    vars.push(
      { name: 'SUPABASE_POOLER_URL', key: 'DATABASE_URL' },
      { name: 'SUPABASE_STAGING_POOLER_URL', key: 'DATABASE_URL' },
    );
  }

  if (config.features.cron || config.deployment?.vercelCron) {
    vars.push({ name: 'CRON_SECRET', key: 'CRON_SECRET' });
  }

  if (config.ai?.rag || config.ai?.chat) {
    vars.push({ name: 'OPENAI_API_KEY', key: 'OPENAI_API_KEY' });
  }

  if (config.ai?.langfuse) {
    vars.push(
      { name: 'LANGFUSE_PUBLIC_KEY', key: 'LANGFUSE_PUBLIC_KEY' },
      { name: 'LANGFUSE_SECRET_KEY', key: 'LANGFUSE_SECRET_KEY' },
      { name: 'LANGFUSE_STAGING_PUBLIC_KEY', key: 'LANGFUSE_PUBLIC_KEY' },
      { name: 'LANGFUSE_STAGING_SECRET_KEY', key: 'LANGFUSE_SECRET_KEY' },
      { name: 'LANGFUSE_BASE_URL', key: 'LANGFUSE_BASE_URL' },
      { name: 'LANGFUSE_STAGING_BASE_URL', key: 'LANGFUSE_BASE_URL' },
    );
  }

  return vars;
}

function buildApiPolicyStatements(config: ProjectConfig): string {
  const needsSecrets = buildSecretEnvironmentVariables(config).length > 0;
  if (!needsSecrets) {
    return '';
  }

  return `        - Statement:
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource: !Ref AppConfigSecretArn`;
}

function generateSamConfig(config: ProjectConfig): string {
  return `version = 0.1

[staging.deploy.parameters]
stack_name = "${config.name}-staging"
resolve_s3 = true
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
parameter_overrides = [
  "Environment=staging",
  "BackendUrl=https://api-staging.example.com",
  "TrustedParentDomains=localhost,example.com",
  "AppConfigSecretArn=arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:${config.name}/staging/app",
  "AppConfigSecretVersion=REPLACE",
  "VpcSubnetIds=subnet-REPLACE1,subnet-REPLACE2",
  "LambdaSecurityGroupIds=sg-REPLACE"
]

[production.deploy.parameters]
stack_name = "${config.name}-production"
resolve_s3 = true
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
parameter_overrides = [
  "Environment=production",
  "BackendUrl=https://api.example.com",
  "TrustedParentDomains=example.com",
  "AppConfigSecretArn=arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:${config.name}/production/app",
  "VpcSubnetIds=subnet-REPLACE1,subnet-REPLACE2",
  "LambdaSecurityGroupIds=sg-REPLACE"
]
`;
}

function generateSamSetupDocs(config: ProjectConfig): string {
  const secretKeys = buildSecretEnvironmentVariables(config)
    .map(({ key }) => key)
    .filter((key, index, keys) => keys.indexOf(key) === index);

  const secretJson = Object.fromEntries(secretKeys.map(key => [key, defaultSecretValue(key)]));

  return `# AWS SAM Setup

This backend runs as:

\`API Gateway HTTP API -> Lambda -> database/private services\`

## 1. Install Local Tools

- AWS CLI v2
- AWS SAM CLI
- Docker Desktop, only needed for \`sam build --use-container\`
- Node.js 22

Configure AWS credentials before deploying:

\`\`\`bash
aws configure sso
aws sts get-caller-identity
\`\`\`

## 2. Secrets Manager

Create one JSON secret per environment, for example \`${config.name}/staging/app\`:

\`\`\`json
${JSON.stringify(secretJson, null, 2)}
\`\`\`

Use the database proxy or pooler endpoint in \`DATABASE_URL\` for Lambda deployments.

## 3. SAM Config

Edit \`samconfig.toml\` and set:

- \`AppConfigSecretArn\`
- \`VpcSubnetIds\`
- \`LambdaSecurityGroupIds\`
- \`BackendUrl\`
- \`TrustedParentDomains\`

## 4. Build and Deploy

\`\`\`bash
pnpm install --frozen-lockfile
pnpm run build
sam build
node scripts/check-sam-runtime-imports.mjs
sam deploy --config-env staging
\`\`\`

After the first deploy, SAM prints \`ApiUrl\`. Put the final API URL back into \`BackendUrl\` and redeploy.

## 5. Database Migrations

Do not run migrations from Lambda startup. Run migrations from a machine that can connect to the database:

\`\`\`bash
pnpm db:migrate
\`\`\`

## 6. Smoke Test

\`\`\`bash
curl https://YOUR_API_ID.execute-api.REGION.amazonaws.com/staging/health
\`\`\`

Expected:

\`\`\`json
{"status":"ok","timestamp":"..."}
\`\`\`
`;
}

function defaultSecretValue(key: string): string {
  if (key === 'DATABASE_URL') {
    return 'postgresql://USER:PASSWORD@proxy-or-pooler-host:5432/DB?sslmode=require';
  }
  if (key === 'LANGFUSE_BASE_URL') {
    return 'https://cloud.langfuse.com';
  }
  if (key.endsWith('_URL') || key === 'SUPABASE_URL') {
    return 'https://example.com';
  }
  if (key.endsWith('_BACKGROUND')) {
    return 'false';
  }
  if (key === 'LANGFUSE_FLUSH_AT') {
    return '1';
  }
  if (key.includes('SECRET') || key.includes('KEY') || key === 'JWT_SECRET') {
    return 'replace-with-secret-value';
  }
  if (key === 'LOG_LEVEL') {
    return 'info';
  }
  return 'replace-me';
}
