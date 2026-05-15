export type Framework = 'express' | 'hono';
export type Database = 'pg' | 'mysql' | 'none' | 'supabase' | 'drizzle';
export type Auth = 'jwt' | 'jwks' | 'supabase' | 'cookie-session' | 'none';
export type AuthMode = 'email-password' | 'oauth-only' | 'both';
export type Queue = 'bull' | 'none';
export type Preset = 'minimal' | 'api' | 'full' | 'ai' | 'production-api' | '1' | 'custom';
export type CronLock = 'pg' | 'mysql' | 'redis' | 'file' | 'supabase';
export type ORM = 'drizzle' | 'raw' | 'none';
export type SecurityMode = 'basic' | 'strict';
export type DeployTarget = 'node' | 'lambda-sam';

// AI-related types
export type EmbeddingProvider = 'openai' | 'gemini' | 'cohere' | 'none';
export type VectorStore = 'supabase' | 'pinecone' | 'chroma' | 'weaviate' | 'none';
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'none';
export type ChatDatabase = 'supabase' | 'pg' | 'mysql' | 'none';

// Auth-related types
export interface AuthFeatures {
  supabaseAdmin?: boolean;
  customJwt?: boolean;
  jwks?: boolean;
  forgotPassword?: boolean;
  googleOAuth?: boolean;
  emailService?: boolean;
  authMode?: AuthMode;
}

export interface AIFeatures {
  rag?: boolean;
  chat?: boolean;
  langfuse?: boolean;
  embeddings?: EmbeddingProvider;
  vectorStore?: VectorStore;
  llmProvider?: LLMProvider;
  chatDatabase?: ChatDatabase;
}

export interface DeploymentFeatures {
  vercel?: boolean;
  vercelCron?: boolean;
  githubWorkflow?: boolean;
  target?: DeployTarget;
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
    security?: SecurityMode;
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
  hasCookieSessionAuth: boolean;
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

/**
 * nod.config.json schema - stores project configuration for component generation
 * Similar to shadcn's components.json
 */
export interface NodConfig {
  $schema?: string;
  name: string;
  framework: Framework;
  typescript: boolean;
  database: Database;
  orm: ORM;
  auth: Auth;
  security?: SecurityMode;
  deployTarget?: DeployTarget;
  
  // Paths for code generation
  paths: {
    src: string;
    routes: string;
    controllers: string;
    services: string;
    middleware: string;
    db: string;
    auth: string;
  };
  
  // Component-specific settings
  components: {
    auth?: {
      supabaseAdmin?: boolean;
      customJwt?: boolean;
      jwks?: boolean;
      forgotPassword?: boolean;
      googleOAuth?: boolean;
      emailService?: boolean;
      authMode?: AuthMode;
    };
    security?: {
      mode?: SecurityMode;
    };
    ai?: {
      rag?: boolean;
      chat?: boolean;
      langfuse?: boolean;
      embeddings?: EmbeddingProvider;
      vectorStore?: VectorStore;
      llmProvider?: LLMProvider;
      chatDatabase?: ChatDatabase;
    };
  };
  
  // Supabase-specific settings
  supabase?: {
    usePooler?: boolean;
    project?: string;
  };
}
