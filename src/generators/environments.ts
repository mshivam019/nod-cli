import * as fs from 'fs-extra';
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
  
  const configContent = `import 'dotenv/config';
import { production } from '../environments/production.js';
import { staging } from '../environments/staging.js';
${hasLangfuse ? `import { CallbackHandler } from 'langfuse-langchain';` : ''}

export const env = process.env.NODE_ENV || 'staging';

// Disable tracing in non-production
if (env !== 'production') {
  process.env.LANGSMITH_TRACING = 'false';
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: env,
  
  // Supabase
  supabaseApiKey: env === 'production' ? production.supabaseSecretKey : staging.supabaseSecretKey,
  supabaseAnonKey: env === 'production' ? production.supabasePublishableKey : staging.supabasePublishableKey,
  supabaseUrl: env === 'production' ? production.supabaseUrl : staging.supabaseUrl,
  supabaseProject: env === 'production' ? production.supabaseProject : staging.supabaseProject,
  ${config.supabase?.usePooler ? `supabasePoolerUrl: env === 'production' ? production.supabasePoolerUrl : staging.supabasePoolerUrl,` : ''}
  
  ${hasRAG ? `// OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,` : ''}
  
  ${hasLangfuse ? `// Langfuse
  langfusePublicKey: env === 'production' ? process.env.LANGFUSE_PUBLIC_KEY : process.env.LANGFUSE_STAGING_PUBLIC_KEY,
  langfuseSecretKey: env === 'production' ? process.env.LANGFUSE_SECRET_KEY : process.env.LANGFUSE_STAGING_SECRET_KEY,` : ''}
  
  // Cron
  cronSecret: process.env.CRON_SECRET,
};

${hasLangfuse ? `
export const langfuseHandler = new CallbackHandler({
  publicKey: config.langfusePublicKey || '',
  secretKey: config.langfuseSecretKey || '',
  baseUrl: 'https://cloud.langfuse.com'
});` : ''}

export default config;
`;

  await fs.outputFile(path.join(projectPath, `src/config/config.${ext}`), configContent);
}
