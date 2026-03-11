import fs from 'fs-extra';
import * as path from 'path';
import { NodConfig, ProjectConfig, Framework, Database, ORM, Auth } from '../types/index.js';

const CONFIG_FILE_NAME = 'nod.config.json';
const NOD_CONFIG_SCHEMA_URL = 'https://raw.githubusercontent.com/mshivam019/nod-cli/main/schema.json';

/**
 * Default paths for a typical nod project
 */
function getDefaultPaths(): NodConfig['paths'] {
  return {
    src: 'src',
    routes: 'src/routes',
    controllers: 'src/controllers',
    services: 'src/services',
    middleware: 'src/middleware',
    db: 'src/db',
    auth: 'src/auth',
  };
}

/**
 * Create a NodConfig from ProjectConfig (used during project init)
 */
export function createNodConfig(config: ProjectConfig): NodConfig {
  return {
    $schema: NOD_CONFIG_SCHEMA_URL,
    name: config.name,
    framework: config.framework,
    typescript: config.typescript,
    database: config.database,
    orm: config.orm || 'raw',
    auth: config.auth,
    paths: getDefaultPaths(),
    components: {
      ai: config.ai ? {
        rag: config.ai.rag,
        chat: config.ai.chat,
        langfuse: config.ai.langfuse,
        embeddings: config.ai.embeddings,
        vectorStore: config.ai.vectorStore,
        llmProvider: config.ai.llmProvider,
        chatDatabase: config.ai.chatDatabase,
      } : undefined,
    },
    supabase: config.supabase,
  };
}

/**
 * Save nod.config.json to project directory
 */
export async function saveNodConfig(projectPath: string, config: NodConfig): Promise<void> {
  const configPath = path.join(projectPath, CONFIG_FILE_NAME);
  await fs.writeJson(configPath, config, { spaces: 2 });
}

/**
 * Load nod.config.json from project directory
 * Returns null if not found
 */
export async function loadNodConfig(projectPath: string = process.cwd()): Promise<NodConfig | null> {
  const configPath = path.join(projectPath, CONFIG_FILE_NAME);
  
  if (!await fs.pathExists(configPath)) {
    return null;
  }
  
  try {
    const config = await fs.readJson(configPath);
    return config as NodConfig;
  } catch (error) {
    console.error('Error reading nod.config.json:', error);
    return null;
  }
}

/**
 * Check if nod.config.json exists in project directory
 */
export async function hasNodConfig(projectPath: string = process.cwd()): Promise<boolean> {
  const configPath = path.join(projectPath, CONFIG_FILE_NAME);
  return fs.pathExists(configPath);
}

/**
 * Update specific fields in nod.config.json
 */
export async function updateNodConfig(
  projectPath: string,
  updates: Partial<NodConfig>
): Promise<void> {
  const config = await loadNodConfig(projectPath);
  
  if (!config) {
    throw new Error('nod.config.json not found. Run `nod init` first or create one manually.');
  }
  
  const updatedConfig = {
    ...config,
    ...updates,
    // Deep merge components
    components: {
      ...config.components,
      ...updates.components,
    },
  };
  
  await saveNodConfig(projectPath, updatedConfig);
}

/**
 * Update auth component settings in nod.config.json
 */
export async function updateAuthConfig(
  projectPath: string,
  authSettings: NodConfig['components']['auth']
): Promise<void> {
  const config = await loadNodConfig(projectPath);
  
  if (!config) {
    throw new Error('nod.config.json not found. Run `nod init` first or create one manually.');
  }
  
  config.components = config.components || {};
  config.components.auth = {
    ...config.components.auth,
    ...authSettings,
  };
  
  await saveNodConfig(projectPath, config);
}

/**
 * Detect project configuration from existing files when nod.config.json doesn't exist
 * This provides backwards compatibility
 */
export async function detectProjectConfig(projectPath: string = process.cwd()): Promise<Partial<NodConfig>> {
  const detected: Partial<NodConfig> = {
    paths: getDefaultPaths(),
    components: {},
  };
  
  // Detect TypeScript
  detected.typescript = await fs.pathExists(path.join(projectPath, 'tsconfig.json'));
  
  // Detect framework from package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    detected.name = packageJson.name;
    
    if (packageJson.dependencies?.hono) {
      detected.framework = 'hono';
    } else if (packageJson.dependencies?.express) {
      detected.framework = 'express';
    }
    
    // Detect ORM
    if (packageJson.dependencies?.['drizzle-orm']) {
      detected.orm = 'drizzle';
    } else {
      detected.orm = 'raw';
    }
    
    // Detect database
    if (packageJson.dependencies?.['@supabase/supabase-js']) {
      detected.database = 'supabase';
    } else if (packageJson.dependencies?.pg || packageJson.dependencies?.postgres) {
      detected.database = 'pg';
    } else if (packageJson.dependencies?.mysql2) {
      detected.database = 'mysql';
    } else {
      detected.database = 'none';
    }
  }
  
  return detected;
}

/**
 * Get project configuration - loads from file or detects from project
 */
export async function getProjectConfig(projectPath: string = process.cwd()): Promise<NodConfig | null> {
  // First try to load from config file
  const config = await loadNodConfig(projectPath);
  if (config) {
    return config;
  }
  
  // Fall back to detection
  const detected = await detectProjectConfig(projectPath);
  
  // If we couldn't detect essential info, return null
  if (!detected.framework || !detected.name) {
    return null;
  }
  
  return {
    name: detected.name,
    framework: detected.framework,
    typescript: detected.typescript ?? true,
    database: detected.database ?? 'none',
    orm: detected.orm ?? 'raw',
    auth: 'none',
    paths: detected.paths!,
    components: detected.components!,
  };
}
