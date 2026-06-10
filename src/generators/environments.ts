import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

export async function generateEnvironments(projectPath: string, config: ProjectConfig, ext: string) {
  // Generate staging environment
  const stagingContent = `export const staging = {
  supabaseSecretKey: process.env.SUPABASE_STAGING_SECRET_KEY,
  supabasePublishableKey: process.env.SUPABASE_STAGING_ANON_KEY || '',
  supabaseProject: process.env.SUPABASE_STAGING_PROJECT || '',
  supabaseUrl: process.env.SUPABASE_STAGING_URL || '',
  ${config.supabase?.usePooler ? `supabasePoolerUrl: process.env.SUPABASE_STAGING_POOLER_URL || '',` : ''}
};
`;

  // Generate production environment
  const productionContent = `export const production = {
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  supabasePublishableKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseProject: process.env.SUPABASE_PROJECT || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  ${config.supabase?.usePooler ? `supabasePoolerUrl: process.env.SUPABASE_POOLER_URL || '',` : ''}
};
`;

  await fs.ensureDir(path.join(projectPath, 'src/environments'));
  await fs.outputFile(path.join(projectPath, `src/environments/staging.${ext}`), stagingContent);
  await fs.outputFile(path.join(projectPath, `src/environments/production.${ext}`), productionContent);
}

export async function generateEnvConfig(projectPath: string, config: ProjectConfig, ext: string) {
  const hasLangfuse = config.ai?.langfuse;
  const hasRAG = config.ai?.rag;
  const hasBetterAuth = config.auth === 'better-auth';
  
  const configContent = `import 'dotenv/config';
import { production } from '../environments/production.js';
import { staging } from '../environments/staging.js';
import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'staging', 'production', 'test']);

export const env = nodeEnvSchema.catch('development').parse(process.env.NODE_ENV);

${hasLangfuse ? `const resolvedLangfusePublicKey = env === 'production'
  ? process.env.LANGFUSE_PUBLIC_KEY
  : (process.env.LANGFUSE_STAGING_PUBLIC_KEY ?? process.env.LANGFUSE_PUBLIC_KEY);

const resolvedLangfuseSecretKey = env === 'production'
  ? process.env.LANGFUSE_SECRET_KEY
  : (process.env.LANGFUSE_STAGING_SECRET_KEY ?? process.env.LANGFUSE_SECRET_KEY);

const resolvedLangfuseBaseUrl = env === 'production'
  ? (process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com')
  : (process.env.LANGFUSE_STAGING_BASE_URL ?? process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com');
` : ''}

// Disable tracing in non-production
if (env !== 'production') {
  process.env.LANGSMITH_TRACING = 'false';
}

const configSchema = z.object({
  port: z.coerce.number().int().positive(),
  nodeEnv: nodeEnvSchema,
  ${hasBetterAuth ? `backendUrl: z.string().url('BACKEND_URL must be a valid URL').optional(),
  authSecret: z.string().min(32, 'BETTER_AUTH_SECRET/AUTH_SECRET must be at least 32 chars'),` : ''}
  
  // Supabase
  supabaseApiKey: z.string().min(1, 'Missing Supabase secret key for current environment'),
  supabaseAnonKey: z.string().min(1, 'Missing Supabase anon key for current environment'),
  supabaseUrl: z.string().url('Supabase URL must be a valid URL'),
  supabaseProject: z.string().min(1, 'Missing Supabase project ID for current environment'),
  ${config.supabase?.usePooler ? `supabasePoolerUrl: z.string().min(1, 'Missing Supabase pooler URL for current environment'),` : ''}
  
  ${hasRAG ? `// OpenAI
  openaiApiKey: z.string().min(1).optional(),` : ''}
  
  ${hasLangfuse ? `// Langfuse
  langfusePublicKey: z.string().min(1).optional(),
  langfuseSecretKey: z.string().min(1).optional(),
  langfuseBaseUrl: z.string().url('Langfuse base URL must be a valid URL'),` : ''}
  
  // Cron
  cronSecret: z.string().min(1).optional(),
})${hasLangfuse ? `.superRefine((value, ctx) => {
  if ((value.langfusePublicKey && !value.langfuseSecretKey) || (!value.langfusePublicKey && value.langfuseSecretKey)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Langfuse public and secret keys must both be set together',
    });
  }
})` : ''};

export const config = configSchema.parse({
  port: process.env.PORT || 3000,
  nodeEnv: env,
  ${hasBetterAuth ? `backendUrl: process.env.BACKEND_URL,
  authSecret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || '',` : ''}
  
  // Supabase
  supabaseApiKey: env === 'production' ? production.supabaseSecretKey : staging.supabaseSecretKey,
  supabaseAnonKey: env === 'production' ? production.supabasePublishableKey : staging.supabasePublishableKey,
  supabaseUrl: env === 'production' ? production.supabaseUrl : staging.supabaseUrl,
  supabaseProject: env === 'production' ? production.supabaseProject : staging.supabaseProject,
  ${config.supabase?.usePooler ? `supabasePoolerUrl: env === 'production' ? production.supabasePoolerUrl : staging.supabasePoolerUrl,` : ''}
  
  ${hasRAG ? `// OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,` : ''}
  
  ${hasLangfuse ? `// Langfuse
  langfusePublicKey: resolvedLangfusePublicKey,
  langfuseSecretKey: resolvedLangfuseSecretKey,
  langfuseBaseUrl: resolvedLangfuseBaseUrl,` : ''}
  
  // Cron
  cronSecret: process.env.CRON_SECRET,
});

${hasLangfuse ? `
process.env.LANGFUSE_BASE_URL = config.langfuseBaseUrl;

if (config.langfusePublicKey && config.langfuseSecretKey) {
  process.env.LANGFUSE_PUBLIC_KEY = config.langfusePublicKey;
  process.env.LANGFUSE_SECRET_KEY = config.langfuseSecretKey;
}` : ''}

export default config;
`;

  await fs.outputFile(path.join(projectPath, `src/config/config.${ext}`), configContent);
}
