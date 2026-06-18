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
    await fs.outputFile(path.join(projectPath, 'scripts/build-lambda.js'), generateLambdaBuildScript());
    await fs.outputFile(path.join(projectPath, 'scripts/check-sam-runtime-imports.js'), generateSamRuntimeImportCheckScript());
    await fs.outputFile(path.join(projectPath, 'scripts/require-codebuild-deploy.js'), generateRequireCodeBuildDeployScript());
  }

  await fs.outputFile(path.join(projectPath, 'template.yaml'), generateSamTemplate(config));
  await fs.outputFile(path.join(projectPath, 'samconfig.toml'), generateSamConfig(config));
  await fs.outputFile(path.join(projectPath, 'docs/aws-sam-setup.md'), generateSamSetupDocs(config));
}

function generateLambdaBuildScript(): string {
  return `import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const layerDir = path.join(root, 'dist-layer');
const layerNodeDir = path.join(layerDir, 'nodejs', 'node22');

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(\`\${command} \${args.join(' ')} failed with exit code \${code}\`));
  });
});

const copyIfExists = async (from, to) => {
  if (existsSync(from)) {
    await cp(from, to, { recursive: true, force: true });
  }
};

const copyRuntimeAssets = async (sourceDir, targetDir) => {
  if (!existsSync(sourceDir)) return;

  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyRuntimeAssets(source, target);
      continue;
    }

    if (/\\.(ts|tsx|d\\.ts|map)$/.test(entry.name)) {
      continue;
    }

    await cp(source, target, { force: true });
  }
};

const writeSamMakefile = async () => {
  await writeFile(path.join(distDir, 'Makefile'), 'build-%:\\n\\tnode copy-sam-artifact.js "$(ARTIFACTS_DIR)"\\n');
  await writeFile(path.join(distDir, 'copy-sam-artifact.js'), \`import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const artifactsDir = process.argv[2];
if (!artifactsDir) throw new Error('Usage: node copy-sam-artifact.js <ARTIFACTS_DIR>');

const sourceDir = process.cwd();
const targetDir = path.resolve(artifactsDir);
if (path.resolve(sourceDir) === targetDir) process.exit(0);

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
  await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
    recursive: true,
    force: true,
  });
}
\`);
};

if (!existsSync('src/lambda.ts')) {
  throw new Error('Missing required Lambda entry point: src/lambda.ts');
}

await rm(distDir, { recursive: true, force: true });
await rm(layerDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await mkdir(layerNodeDir, { recursive: true });

await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.lambda.json']);
await copyRuntimeAssets(path.join(root, 'src'), distDir);

await writeFile(
  path.join(distDir, 'package.json'),
  \`\${JSON.stringify({ type: 'module' }, null, 2)}\\n\`,
);

await copyIfExists(path.join(root, 'package.json'), path.join(layerNodeDir, 'package.json'));
await copyIfExists(path.join(root, 'pnpm-lock.yaml'), path.join(layerNodeDir, 'pnpm-lock.yaml'));
await copyIfExists(path.join(root, 'pnpm-workspace.yaml'), path.join(layerNodeDir, 'pnpm-workspace.yaml'));

await run('pnpm', [
  'install',
  '--prod',
  '--frozen-lockfile',
  '--config.node-linker=hoisted',
  '--config.package-import-method=copy',
  '--config.auto-install-peers=false',
], { cwd: layerNodeDir });
await writeSamMakefile();

console.log('Built Lambda function artifact in dist/ and dependency layer in dist-layer/.');
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
import { lstat, readlink, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const buildTemplatePath = path.resolve('.aws-sam', 'build', 'template.yaml');
const sourceTemplatePath = path.resolve('template.yaml');
const templatePath = existsSync(buildTemplatePath) ? buildTemplatePath : sourceTemplatePath;
const templateRoot = path.dirname(templatePath);

const defaultEnv = {
  AUTH_JWT_AUDIENCE: 'sam-runtime-import-check',
  AUTH_JWT_ISSUER: 'sam-runtime-import-check',
  BACKEND_URL: 'https://example.invalid',
  BETTER_AUTH_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  CORS_ALLOWED_ORIGINS: 'https://example.invalid',
  CRON_SECRET: 'sam-runtime-import-check-secret-00000000000000000000000000000000',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  DATABASE_CONNECT_TIMEOUT_SECONDS: '5',
  DATABASE_IDLE_TIMEOUT_SECONDS: '20',
  DATABASE_MAX_LIFETIME_SECONDS: '1800',
  DATABASE_POOL_MAX: '2',
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
  throw new Error('Missing template.yaml. Run from the SAM backend repository root.');
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
  const functionDir = path.resolve(templateRoot, codeUri);
  checks.push({
    resource,
    handler,
    exportName,
    candidates: [
      path.join(functionDir, \`\${modulePath}.js\`),
      path.join(functionDir, \`\${modulePath}.mjs\`),
      path.join(functionDir, \`\${modulePath}.cjs\`),
    ],
  });
}

const failures = [];
const temporaryLinks = [];

const layerNodeModulesCandidates = [
  path.resolve(templateRoot, 'DependencyLayer', 'nodejs', 'node22', 'node_modules'),
  path.resolve(templateRoot, 'DependencyLayer', 'nodejs', 'node_modules'),
  path.resolve('dist-layer', 'nodejs', 'node22', 'node_modules'),
  path.resolve('dist-layer', 'nodejs', 'node_modules'),
];

const layerNodeModules = layerNodeModulesCandidates.find((candidate) => existsSync(candidate));

const linkLayerDependencies = async (functionDir) => {
  if (!layerNodeModules) return;

  const functionNodeModules = path.join(functionDir, 'node_modules');
  if (existsSync(functionNodeModules)) {
    const stat = await lstat(functionNodeModules);
    if (!stat.isSymbolicLink()) return;

    const target = await readlink(functionNodeModules);
    if (path.resolve(functionDir, target) !== layerNodeModules && path.resolve(target) !== layerNodeModules) return;

    await unlink(functionNodeModules);
  }

  await symlink(layerNodeModules, functionNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
  temporaryLinks.push(functionNodeModules);
};

for (const [index, check] of checks.entries()) {
  const filePath = check.candidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    failures.push(\`\${check.resource} Handler=\${check.handler} missing handler file\`);
    continue;
  }

  try {
    await linkLayerDependencies(path.dirname(filePath));
    const moduleUrl = \`\${pathToFileURL(filePath).href}?sam-runtime-import-check=\${index}\`;
    const moduleExports = await import(moduleUrl);
    if (!(check.exportName in moduleExports)) {
      failures.push(\`\${check.resource} Handler=\${check.handler} missing export "\${check.exportName}" in \${filePath}\`);
    }
  } catch (error) {
    failures.push(\`\${check.resource} Handler=\${check.handler} failed to import \${filePath}: \${error.stack || error.message}\`);
  }
}

for (const linkPath of temporaryLinks.reverse()) {
  try {
    const stat = await lstat(linkPath);
    if (stat.isSymbolicLink()) {
      await unlink(linkPath);
    }
  } catch {
    // Best-effort cleanup only.
  }
}

if (failures.length > 0) {
  throw new Error(\`SAM runtime import check failed:\\n\${failures.join('\\n\\n')}\`);
}

console.log(\`Verified \${checks.length} SAM handler file(s) import successfully using \${path.relative(process.cwd(), templatePath) || 'template.yaml'}.\`);
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
    Metadata:
      BuildMethod: makefile
    Properties:
      CodeUri: dist/
      Handler: cron-lambda.handler
      Layers:
        - !Ref DependencyLayer
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
        DATABASE_POOL_MAX: '2'
        DATABASE_CONNECT_TIMEOUT_SECONDS: '5'
        DATABASE_IDLE_TIMEOUT_SECONDS: '20'
        DATABASE_MAX_LIFETIME_SECONDS: '1800'
${langfuseRuntimeEnvBlock}${secretEnvBlock}

Resources:
  DependencyLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: !Sub "\${AWS::StackName}-dependencies"
      Description: Production Node.js dependencies for this backend.
      ContentUri: dist-layer/
      CompatibleRuntimes:
        - nodejs22.x
      CompatibleArchitectures:
        - arm64
      RetentionPolicy: Delete

  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Environment

  ApiFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: makefile
    Properties:
      CodeUri: dist/
      Handler: lambda.handler
      Layers:
        - !Ref DependencyLayer
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
sam build --parallel
node scripts/check-sam-runtime-imports.js
sam deploy --config-env staging
\`\`\`

The build emits ESM \`.js\` files into \`dist/\` and installs production dependencies into \`dist-layer/\` with pnpm. Do not add a committed \`.npmrc\`; project pnpm policy belongs in \`pnpm-workspace.yaml\`. The dependency-layer install uses command-local pnpm flags so Lambda receives copied, hoisted production dependencies.

After the first deploy, SAM prints \`ApiUrl\`. Put the final API URL back into \`BackendUrl\` and redeploy.

## 5. Database Migrations

Do not run migrations from Lambda startup. Run migrations from a machine that can connect to the database:

\`\`\`bash
pnpm db:migrate
\`\`\`

Lambda Drizzle clients default to:

- \`DATABASE_POOL_MAX=2\`
- \`DATABASE_CONNECT_TIMEOUT_SECONDS=5\`
- \`DATABASE_IDLE_TIMEOUT_SECONDS=20\`
- \`DATABASE_MAX_LIFETIME_SECONDS=1800\`

Use an RDS Proxy or database pooler endpoint in \`DATABASE_URL\`.

## 6. Rate Limits And Audit

For Postgres-backed rate limits, the generated code uses static Drizzle SQL. Do not switch to dynamic Drizzle adapters that compute \`import('drizzle-orm')\` at runtime unless the package is tested through \`scripts/check-sam-runtime-imports.js\`.

Generated DB audit middleware skips \`GET\`, \`HEAD\`, and \`OPTIONS\` writes. Use ALB/API Gateway/WAF/access logs for read-path traffic and keep DB audit rows for mutations or explicit domain events.

## 7. Smoke Test

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
