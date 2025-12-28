import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ProjectConfig } from '../types/index.js';
import { generateProject } from '../generators/project.js';
import { loadPresetsConfig, getDefaultPreset, getBuiltinPresets, isBuiltinPreset } from '../utils/presets.js';

export async function initProject(name?: string, options?: any) {
  console.log(chalk.blue.bold('\n🚀 Welcome to nod-cli!\n'));

  let config: ProjectConfig;

  // Load custom presets and default
  const presetsConfig = await loadPresetsConfig();
  const defaultPreset = await getDefaultPreset();
  
  // Check for non-interactive mode (--yes or -y flag, or CI environment)
  const isNonInteractive = options?.yes || options?.y || process.env.CI === 'true';
  
  // Determine which preset to use
  let presetToUse = options?.preset;
  if (!presetToUse && isNonInteractive && defaultPreset) {
    presetToUse = defaultPreset;
  }
  
  // If non-interactive and we have all required options, skip prompts
  if (isNonInteractive && name && presetToUse && options?.framework) {
    const presetDefaults = await getPresetDefaults(presetToUse, presetsConfig);
    const isTS = options.ts !== false;
    
    config = {
      name,
      framework: options.framework || 'express',
      typescript: isTS,
      database: presetDefaults.database || 'pg',
      auth: presetDefaults.auth || 'jwt',
      queue: presetDefaults.queue || 'none',
      preset: presetToUse,
      orm: presetDefaults.orm || 'raw',
      features: {
        cron: presetDefaults.features?.cron ?? false,
        cronLock: presetDefaults.features?.cronLock || 'file',
        logging: true,
        testing: presetDefaults.features?.testing ?? true,
        docker: presetDefaults.features?.docker ?? true,
        pm2: presetDefaults.features?.pm2 ?? true,
        environments: presetDefaults.features?.environments ?? true,
        sourceConfig: presetDefaults.features?.sourceConfig ?? false,
        modelConfig: presetDefaults.features?.modelConfig ?? false,
        apiAudit: presetDefaults.features?.apiAudit ?? false,
      },
      ai: {
        rag: presetDefaults.ai?.rag ?? false,
        chat: presetDefaults.ai?.chat ?? false,
        langfuse: presetDefaults.ai?.langfuse ?? false,
        embeddings: presetDefaults.ai?.rag ? 'openai' : 'none',
      },
      deployment: {
        vercel: presetDefaults.deployment?.vercel ?? false,
        vercelCron: presetDefaults.deployment?.vercelCron ?? false,
        githubWorkflow: presetDefaults.deployment?.githubWorkflow ?? true,
      },
      supabase: {
        usePooler: presetDefaults.orm === 'drizzle',
      }
    };
    
    const spinner = ora('Generating project...').start();
    
    try {
      await generateProject(config);
      spinner.succeed(chalk.green('Project generated successfully!'));
      printNextSteps(config);
    } catch (error) {
      spinner.fail(chalk.red('Failed to generate project'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  // Build preset choices including custom presets
  const builtinPresets = getBuiltinPresets();
  const customPresetNames = Object.keys(presetsConfig.presets);
  
  const presetChoices = [
    { title: 'Minimal - Basic setup', value: 'minimal' },
    { title: 'API - Standard REST API', value: 'api' },
    { title: 'Full - All features', value: 'full' },
    { title: 'AI - RAG, Chat, Langfuse', value: 'ai' },
    { title: '1 - Your stack (Supabase + Drizzle + Vercel + AI)', value: '1' },
    ...customPresetNames.map(name => {
      const preset = presetsConfig.presets[name];
      const desc = preset.description ? ` - ${preset.description}` : '';
      return { title: `${name}${desc}`, value: name };
    }),
    { title: 'Custom - Choose features', value: 'custom' }
  ];
  
  // Find initial index for default preset
  let initialPresetIndex = 1; // default to 'api'
  if (defaultPreset) {
    const idx = presetChoices.findIndex(c => c.value === defaultPreset);
    if (idx !== -1) initialPresetIndex = idx;
  }

  // Interactive mode
  const response = await prompts([
    {
      type: name ? null : 'text',
      name: 'name',
      message: 'Project name:',
      initial: 'my-backend'
    },
    {
      type: 'select',
      name: 'preset',
      message: `Choose a preset:${defaultPreset ? chalk.gray(` (default: ${defaultPreset})`) : ''}`,
      choices: presetChoices,
      initial: initialPresetIndex
    },
    {
      type: 'select',
      name: 'framework',
      message: 'Choose your framework:',
      choices: [
        { title: 'Express', value: 'express' },
        { title: 'Hono', value: 'hono' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      initial: true
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'select' : null,
      name: 'database',
      message: 'Database:',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Supabase', value: 'supabase' },
        { title: 'None', value: 'none' }
      ],
      initial: 0
    },
    {
      type: (_prev, values) => (values.preset === 'custom' && (values.database === 'pg' || values.database === 'supabase')) ? 'select' : null,
      name: 'orm',
      message: 'ORM:',
      choices: [
        { title: 'Drizzle ORM', value: 'drizzle' },
        { title: 'Raw SQL', value: 'raw' },
        { title: 'None', value: 'none' }
      ],
      initial: 0
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'select' : null,
      name: 'auth',
      message: 'Authentication:',
      choices: [
        { title: 'JWT', value: 'jwt' },
        { title: 'JWKS (JWT with key rotation)', value: 'jwks' },
        { title: 'Supabase Auth', value: 'supabase' },
        { title: 'None', value: 'none' }
      ],
      initial: 0
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'cron',
      message: 'Include cron jobs support?',
      initial: false
    },
    {
      type: (_prev, values) => (values.preset === 'custom' && values.cron) ? 'select' : null,
      name: 'cronLock',
      message: 'Cron lock backend (for PM2 cluster mode):',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Redis', value: 'redis' },
        { title: 'Supabase', value: 'supabase' },
        { title: 'File-based', value: 'file' }
      ],
      initial: 0
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'select' : null,
      name: 'queue',
      message: 'Job queue:',
      choices: [
        { title: 'BullMQ (Redis-based)', value: 'bull' },
        { title: 'None', value: 'none' }
      ],
      initial: 1
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'environments',
      message: 'Include environment config (staging/production)?',
      initial: true
    },
    {
      type: (_prev, values) => values.preset === 'custom' || values.preset === 'ai' ? 'confirm' : null,
      name: 'rag',
      message: 'Include RAG (Retrieval Augmented Generation)?',
      initial: (values: any) => values.preset === 'ai'
    },
    {
      type: (_prev, values) => values.preset === 'custom' || values.preset === 'ai' ? 'confirm' : null,
      name: 'chat',
      message: 'Include Chat service?',
      initial: (values: any) => values.preset === 'ai'
    },
    {
      type: (_prev, values) => (values.preset === 'custom' || values.preset === 'ai') && (values.rag || values.chat) ? 'confirm' : null,
      name: 'langfuse',
      message: 'Include Langfuse for LLM observability?',
      initial: true
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'vercelCron',
      message: 'Include Vercel cron configuration?',
      initial: false
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'githubWorkflow',
      message: 'Include GitHub workflow?',
      initial: true
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'docker',
      message: 'Include Docker configuration?',
      initial: true
    },
    {
      type: (_prev, values) => values.preset === 'custom' ? 'confirm' : null,
      name: 'pm2',
      message: 'Include PM2 configuration?',
      initial: true
    }
  ]);

  if (!response.name && !name) {
    console.log(chalk.red('\n❌ Setup cancelled'));
    process.exit(1);
  }

  // Apply preset defaults
  const presetDefaults = await getPresetDefaults(response.preset || 'api', presetsConfig);
  
  config = {
    name: name || response.name,
    framework: response.framework || 'express',
    typescript: response.typescript !== false,
    database: response.database || presetDefaults.database || 'pg',
    auth: response.auth || presetDefaults.auth || 'jwt',
    queue: response.queue || presetDefaults.queue || 'none',
    preset: response.preset || 'api',
    orm: response.orm || presetDefaults.orm || 'raw',
    features: {
      cron: response.cron ?? presetDefaults.features?.cron ?? false,
      cronLock: response.cronLock || presetDefaults.features?.cronLock || 'file',
      logging: true,
      testing: presetDefaults.features?.testing ?? true,
      docker: response.docker ?? presetDefaults.features?.docker ?? true,
      pm2: response.pm2 ?? presetDefaults.features?.pm2 ?? true,
      environments: response.environments ?? presetDefaults.features?.environments ?? true,
      sourceConfig: presetDefaults.features?.sourceConfig ?? false,
      modelConfig: presetDefaults.features?.modelConfig ?? false,
      apiAudit: presetDefaults.features?.apiAudit ?? false,
    },
    ai: {
      rag: response.rag ?? presetDefaults.ai?.rag ?? false,
      chat: response.chat ?? presetDefaults.ai?.chat ?? false,
      langfuse: response.langfuse ?? presetDefaults.ai?.langfuse ?? false,
      embeddings: (response.rag || presetDefaults.ai?.rag) ? 'openai' : 'none',
    },
    deployment: {
      vercel: response.vercelCron ?? presetDefaults.deployment?.vercel ?? false,
      vercelCron: response.vercelCron ?? presetDefaults.deployment?.vercelCron ?? false,
      githubWorkflow: response.githubWorkflow ?? presetDefaults.deployment?.githubWorkflow ?? true,
    },
    supabase: {
      usePooler: response.orm === 'drizzle' || presetDefaults.orm === 'drizzle',
    }
  };

  const spinner = ora('Generating project...').start();

  try {
    await generateProject(config);
    spinner.succeed(chalk.green('Project generated successfully!'));
    printNextSteps(config);
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate project'));
    console.error(error);
    process.exit(1);
  }
}

function printNextSteps(config: ProjectConfig) {
  console.log(chalk.blue('\n📦 Next steps:'));
  console.log(chalk.gray(`  cd ${config.name}`));
  console.log(chalk.gray('  npm install'));
  console.log(chalk.gray('  cp .env.example .env'));
  console.log(chalk.gray('  npm run dev\n'));

  if (config.orm === 'drizzle') {
    console.log(chalk.yellow('📝 Drizzle Setup:'));
    console.log(chalk.gray('  npx drizzle-kit generate'));
    console.log(chalk.gray('  npx drizzle-kit push\n'));
  }

  if (config.ai?.rag || config.ai?.chat) {
    console.log(chalk.yellow('🤖 AI Features:'));
    console.log(chalk.gray('  Set OPENAI_API_KEY in .env'));
    if (config.ai?.langfuse) {
      console.log(chalk.gray('  Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env\n'));
    }
  }
}

// Built-in presets
const BUILTIN_PRESETS: Record<string, Partial<ProjectConfig>> = {
  minimal: {
    database: 'none',
    auth: 'none',
    queue: 'none',
    orm: 'none',
    features: {
      cron: false,
      logging: true,
      testing: false,
      docker: false,
      pm2: false,
      environments: false,
      sourceConfig: false,
      modelConfig: false,
    },
    ai: { rag: false, chat: false, langfuse: false },
    deployment: { vercel: false, vercelCron: false, githubWorkflow: false },
  },
  api: {
    database: 'pg',
    auth: 'jwt',
    queue: 'none',
    orm: 'raw',
    features: {
      cron: false,
      logging: true,
      testing: true,
      docker: true,
      pm2: true,
      environments: true,
      sourceConfig: false,
      modelConfig: false,
    },
    ai: { rag: false, chat: false, langfuse: false },
    deployment: { vercel: false, vercelCron: false, githubWorkflow: true },
  },
  full: {
    database: 'supabase',
    auth: 'supabase',
    queue: 'none',
    orm: 'drizzle',
    features: {
      cron: true,
      cronLock: 'supabase',
      logging: true,
      testing: true,
      docker: true,
      pm2: true,
      environments: true,
      sourceConfig: true,
      modelConfig: true,
    },
    ai: { rag: false, chat: false, langfuse: false },
    deployment: { vercel: true, vercelCron: true, githubWorkflow: true },
  },
  ai: {
    database: 'supabase',
    auth: 'supabase',
    queue: 'none',
    orm: 'drizzle',
    features: {
      cron: true,
      cronLock: 'supabase',
      logging: true,
      testing: true,
      docker: true,
      pm2: true,
      environments: true,
      sourceConfig: true,
      modelConfig: true,
    },
    ai: { rag: true, chat: true, langfuse: true, embeddings: 'openai' },
    deployment: { vercel: true, vercelCron: true, githubWorkflow: true },
  },
  // Preset "1" - Your exact stack from sample projects
  '1': {
    database: 'supabase',
    auth: 'supabase',
    queue: 'none',
    orm: 'drizzle',
    features: {
      cron: false,
      cronLock: 'supabase',
      logging: true,
      testing: false,
      docker: false,
      pm2: false,
      environments: true,
      sourceConfig: true,
      modelConfig: false,
      apiAudit: true,
    },
    ai: { rag: false, chat: false, langfuse: true, embeddings: 'none' },
    deployment: { vercel: false, vercelCron: false, githubWorkflow: true },
  },
  custom: {
    database: 'pg',
    auth: 'jwt',
    queue: 'none',
    orm: 'raw',
    features: {
      cron: false,
      logging: true,
      testing: true,
      docker: true,
      pm2: true,
      environments: true,
      sourceConfig: false,
      modelConfig: false,
    },
    ai: { rag: false, chat: false, langfuse: false },
    deployment: { vercel: false, vercelCron: false, githubWorkflow: true },
  },
};

async function getPresetDefaults(preset: string, presetsConfig?: { presets: Record<string, { config: Partial<ProjectConfig> }> }): Promise<Partial<ProjectConfig>> {
  // Check built-in presets first
  if (BUILTIN_PRESETS[preset]) {
    return BUILTIN_PRESETS[preset];
  }
  
  // Check custom presets
  if (presetsConfig?.presets[preset]) {
    return presetsConfig.presets[preset].config;
  }
  
  // Fallback to api preset
  return BUILTIN_PRESETS.api;
}
