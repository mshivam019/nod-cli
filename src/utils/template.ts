import Handlebars from 'handlebars';
import { TemplateContext, ProjectConfig } from '../types/index.js';

export function compileTemplate(template: string, context: TemplateContext): string {
  const compiled = Handlebars.compile(template);
  return compiled(context);
}

export function getTemplateContext(config: ProjectConfig): TemplateContext {
  const fileExt = config.typescript ? 'ts' : 'js';
  
  return {
    projectName: config.name,
    framework: config.framework,
    useTS: config.typescript,
    hasAuth: config.auth !== 'none',
    hasJWKS: config.auth === 'jwks',
    hasSupabaseAuth: config.auth === 'supabase',
    hasDatabase: config.database !== 'none',
    databaseType: config.database,
    hasQueue: config.queue !== 'none',
    hasCron: config.features.cron,
    hasLogging: config.features.logging,
    fileExt,
    hasEnvironments: config.features.environments || false,
    hasSourceConfig: config.features.sourceConfig || false,
    hasModelConfig: config.features.modelConfig || false,
    hasRAG: config.ai?.rag || false,
    hasChat: config.ai?.chat || false,
    hasLangfuse: config.ai?.langfuse || false,
    hasVercel: config.deployment?.vercel || false,
    hasVercelCron: config.deployment?.vercelCron || false,
    hasGithubWorkflow: config.deployment?.githubWorkflow || false,
    hasDrizzle: config.orm === 'drizzle',
    hasSupabase: config.database === 'supabase' || config.auth === 'supabase',
    hasApiAudit: config.features.apiAudit || false,
  };
}
