export type Framework = 'express' | 'hono';
export type Database = 'pg' | 'mysql' | 'none';
export type Auth = 'jwt' | 'jwks' | 'none';
export type Queue = 'bull' | 'none';
export type Preset = 'minimal' | 'api' | 'full' | 'custom';
export type CronLock = 'pg' | 'mysql' | 'redis' | 'file';

export interface ProjectConfig {
  name: string;
  framework: Framework;
  typescript: boolean;
  database: Database;
  auth: Auth;
  queue: Queue;
  preset: Preset;
  features: {
    cron: boolean;
    cronLock?: CronLock;
    logging: boolean;
    testing: boolean;
    docker?: boolean;
    pm2?: boolean;
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
  hasDatabase: boolean;
  databaseType: string;
  hasQueue: boolean;
  hasCron: boolean;
  hasLogging: boolean;
  fileExt: string;
}
