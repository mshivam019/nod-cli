export type Framework = 'express' | 'hono';
export type Database = 'pg' | 'mysql' | 'none' | 'supabase' | 'drizzle';
export type Auth = 'jwt' | 'jwks' | 'supabase' | 'none';
export type Queue = 'bull' | 'none';
export type Preset = 'minimal' | 'api' | 'full' | 'ai' | '1' | 'custom';
export type CronLock = 'pg' | 'mysql' | 'redis' | 'file' | 'supabase';
export type ORM = 'drizzle' | 'raw' | 'none';

export interface AIFeatures {
  rag?: boolean;
  chat?: boolean;
  langfuse?: boolean;
  embeddings?: 'openai' | 'none';
}

export interface DeploymentFeatures {
  vercel?: boolean;
  vercelCron?: boolean;
  githubWorkflow?: boolean;
}

export interface ProjectConfig {
  name: string;
  framework: Framework;
  typescript: boolean;
  database: Database;
  auth: Auth;
  queue: Queue;
  preset: Preset;
  orm?: ORM;
  features: {
    cron: boolean;
    cronLock?: CronLock;
    logging: boolean;
    testing: boolean;
    docker?: boolean;
    pm2?: boolean;
    environments?: boolean;
    sourceConfig?: boolean;
    modelConfig?: boolean;
    apiAudit?: boolean;
  };
  ai?: AIFeatures;
  deployment?: DeploymentFeatures;
  supabase?: {
    usePooler?: boolean;
    project?: string;
  };
}

export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  controller: string;
  service: string;
  middleware?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface MiddlewareConfig {
  name: string;
  isDefault: boolean;
  handler: string;
}

export interface TemplateContext {
  projectName: string;
  framework: Framework;
  useTS: boolean;
  hasAuth: boolean;
  hasJWKS: boolean;
  hasSupabaseAuth: boolean;
  hasDatabase: boolean;
  databaseType: string;
  hasQueue: boolean;
  hasCron: boolean;
  hasLogging: boolean;
  fileExt: string;
  hasEnvironments: boolean;
  hasSourceConfig: boolean;
  hasModelConfig: boolean;
  hasRAG: boolean;
  hasChat: boolean;
  hasLangfuse: boolean;
  hasVercel: boolean;
  hasVercelCron: boolean;
  hasGithubWorkflow: boolean;
  hasDrizzle: boolean;
  hasSupabase: boolean;
  hasApiAudit: boolean;
}
