import chalk from 'chalk';
import prompts from 'prompts';
import {
  loadPresetsConfig,
  savePreset,
  deletePreset,
  listPresets,
  setDefaultPreset,
  getDefaultPreset,
  isBuiltinPreset,
  getBuiltinPresets,
  CustomPreset,
} from '../utils/presets.js';
import { ProjectConfig } from '../types/index.js';

const DATABASE_VALUES = ['pg', 'mysql', 'supabase', 'none'] as const;
const ORM_VALUES = ['drizzle', 'raw', 'none'] as const;
const AUTH_VALUES = ['jwt', 'jwks', 'supabase', 'better-auth', 'cookie-session', 'none'] as const;
const SECURITY_VALUES = ['basic', 'strict'] as const;
const DEPLOY_TARGET_VALUES = ['node', 'lambda-sam'] as const;

function isNonInteractive(options?: any): boolean {
  return Boolean(options?.yes || process.env.CI === 'true');
}

function parseBooleanOption(value: unknown, optionName: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;

  console.log(chalk.red(`\n❌ Invalid value for ${optionName}: ${String(value)}. Use true or false.\n`));
  process.exit(1);
}

function parseEnumOption<T extends readonly string[]>(
  value: unknown,
  validValues: T,
  optionName: string
): T[number] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim();
  if ((validValues as readonly string[]).includes(normalized)) {
    return normalized as T[number];
  }

  console.log(chalk.red(`\n❌ Invalid value for ${optionName}: ${normalized}. Valid values: ${validValues.join(', ')}\n`));
  process.exit(1);
}

export async function presetCommand(action?: string, name?: string, options?: any) {
  switch (action) {
    case 'list':
    case 'ls':
      await listPresetsCommand();
      break;
    case 'create':
    case 'add':
      await createPresetCommand(name, options);
      break;
    case 'delete':
    case 'rm':
      await deletePresetCommand(name, options);
      break;
    case 'default':
      await setDefaultCommand(name, options);
      break;
    case 'show':
      await showPresetCommand(name);
      break;
    default:
      await showPresetHelp();
  }
}

async function listPresetsCommand() {
  const customPresets = await listPresets();
  const defaultPreset = await getDefaultPreset();
  const builtinPresets = getBuiltinPresets();
  
  console.log(chalk.blue.bold('\n📦 Available Presets\n'));
  
  // Built-in presets
  console.log(chalk.yellow('Built-in:'));
  for (const name of builtinPresets) {
    const isDefault = defaultPreset === name;
    const marker = isDefault ? chalk.green(' (default)') : '';
    console.log(`  ${chalk.cyan(name)}${marker}`);
  }
  
  // Custom presets
  if (customPresets.length > 0) {
    console.log(chalk.yellow('\nCustom:'));
    for (const preset of customPresets) {
      const isDefault = defaultPreset === preset.name;
      const marker = isDefault ? chalk.green(' (default)') : '';
      const desc = preset.description ? chalk.gray(` - ${preset.description}`) : '';
      console.log(`  ${chalk.cyan(preset.name)}${marker}${desc}`);
    }
  }
  
  console.log(chalk.gray('\nUse `nod preset show <name>` to see preset details'));
  console.log(chalk.gray('Use `nod preset default <name>` to set default preset\n'));
}

async function createPresetCommand(name?: string, options?: any) {
  console.log(chalk.blue.bold('\n🔧 Create Custom Preset\n'));

  const nonInteractive = isNonInteractive(options);
  if (nonInteractive && !name) {
    console.log(chalk.red('\n❌ Preset name is required in non-interactive mode.\n'));
    process.exit(1);
  }

  const optionDefaults = {
    database: parseEnumOption(options?.db, DATABASE_VALUES, '--db') || 'supabase',
    orm: parseEnumOption(options?.orm, ORM_VALUES, '--orm'),
    auth: parseEnumOption(options?.auth, AUTH_VALUES, '--auth') || 'better-auth',
    security: parseEnumOption(options?.security, SECURITY_VALUES, '--security') || 'strict',
    deployTarget: parseEnumOption(options?.deployTarget, DEPLOY_TARGET_VALUES, '--deploy-target') || 'lambda-sam',
    cron: parseBooleanOption(options?.cron, '--cron') ?? false,
    environments: parseBooleanOption(options?.environments, '--environments') ?? true,
    apiAudit: parseBooleanOption(options?.apiAudit, '--api-audit') ?? true,
    langfuse: parseBooleanOption(options?.langfuse, '--langfuse') ?? false,
    vercelCron: parseBooleanOption(options?.vercelCron, '--vercel-cron') ?? false,
    githubWorkflow: parseBooleanOption(options?.githubWorkflow, '--github-workflow') ?? true,
    docker: parseBooleanOption(options?.docker, '--docker') ?? false,
    pm2: parseBooleanOption(options?.pm2, '--pm2') ?? false,
    testing: parseBooleanOption(options?.testing, '--testing') ?? true,
  };

  if (!optionDefaults.orm) {
    optionDefaults.orm = optionDefaults.database === 'pg' || optionDefaults.database === 'supabase'
      ? 'drizzle'
      : 'none';
  }
  
  const response = nonInteractive ? {
    name,
    description: options?.description,
    ...optionDefaults,
  } : await prompts([
    {
      type: name ? null : 'text',
      name: 'name',
      message: 'Preset name:',
      validate: (value) => {
        if (!value || value.trim().length === 0) return 'Name is required';
        if (isBuiltinPreset(value)) return 'Cannot use built-in preset name';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Name can only contain letters, numbers, hyphens, and underscores';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description (optional):',
    },
    {
      type: 'select',
      name: 'database',
      message: 'Database:',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Supabase', value: 'supabase' },
        { title: 'None', value: 'none' }
      ],
      initial: 2
    },
    {
      type: (_prev, values) => (values.database === 'pg' || values.database === 'supabase') ? 'select' : null,
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
      type: 'select',
      name: 'auth',
      message: 'Authentication:',
      choices: [
        { title: 'JWT', value: 'jwt' },
        { title: 'JWKS (JWT with key rotation)', value: 'jwks' },
        { title: 'Supabase Auth', value: 'supabase' },
        { title: 'Better Auth', value: 'better-auth' },
        { title: 'Cookie Session', value: 'cookie-session' },
        { title: 'None', value: 'none' }
      ],
      initial: 3
    },
    {
      type: 'select',
      name: 'security',
      message: 'Security profile:',
      choices: [
        { title: 'Basic', value: 'basic' },
        { title: 'Strict', value: 'strict' }
      ],
      initial: 1
    },
    {
      type: 'select',
      name: 'deployTarget',
      message: 'Deployment target:',
      choices: [
        { title: 'Node server', value: 'node' },
        { title: 'AWS Lambda + SAM', value: 'lambda-sam' }
      ],
      initial: 1
    },
    {
      type: 'confirm',
      name: 'cron',
      message: 'Include cron jobs support?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'environments',
      message: 'Include environment config (staging/production)?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'apiAudit',
      message: 'Include API audit logging?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'langfuse',
      message: 'Include Langfuse for LLM observability?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'vercelCron',
      message: 'Include Vercel cron configuration?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'githubWorkflow',
      message: 'Include GitHub workflow?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'docker',
      message: 'Include Docker configuration?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'pm2',
      message: 'Include PM2 configuration?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'testing',
      message: 'Include testing setup?',
      initial: false
    },
  ]);
  
  if (!response.name && !name) {
    console.log(chalk.red('\n❌ Preset creation cancelled\n'));
    return;
  }
  
  const presetName = name || response.name;
  
  const config: Partial<ProjectConfig> = {
    database: response.database,
    auth: response.auth,
    queue: 'none',
    orm: response.orm || 'raw',
    features: {
      cron: response.cron,
      cronLock: response.database === 'supabase' ? 'supabase' : 'file',
      logging: true,
      testing: response.testing,
      docker: response.docker,
      pm2: response.pm2,
      environments: response.environments,
      apiAudit: response.apiAudit,
      security: response.security,
    },
    ai: {
      rag: false,
      chat: false,
      langfuse: response.langfuse,
      embeddings: 'none',
    },
    deployment: {
      vercel: response.vercelCron,
      vercelCron: response.vercelCron,
      githubWorkflow: response.githubWorkflow,
      target: response.deployTarget,
    },
    supabase: {
      usePooler: response.orm === 'drizzle',
    },
  };
  
  try {
    await savePreset(presetName, config, response.description);
    console.log(chalk.green(`\n✅ Preset '${presetName}' created successfully!\n`));
    console.log(chalk.gray(`Use it with: nod init my-project --preset ${presetName}\n`));
  } catch (error: any) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
  }
}

async function deletePresetCommand(name?: string, options?: any) {
  const nonInteractive = isNonInteractive(options);

  if (!name) {
    if (nonInteractive) {
      console.log(chalk.red('\n❌ Preset name is required in non-interactive mode.\n'));
      process.exit(1);
    }

    const customPresets = await listPresets();
    
    if (customPresets.length === 0) {
      console.log(chalk.yellow('\nNo custom presets to delete.\n'));
      return;
    }
    
    const response = await prompts({
      type: 'select',
      name: 'name',
      message: 'Select preset to delete:',
      choices: customPresets.map(p => ({ title: p.name, value: p.name }))
    });
    
    if (!response.name) {
      console.log(chalk.red('\n❌ Deletion cancelled\n'));
      return;
    }
    
    name = response.name;
  }
  
  if (nonInteractive && !options?.yes) {
    console.log(chalk.red('\n❌ Refusing to delete without --yes in non-interactive mode.\n'));
    process.exit(1);
  }

  const confirm = options?.yes ? { yes: true } : await prompts({
      type: 'confirm',
      name: 'yes',
      message: `Delete preset '${name}'?`,
      initial: false
    });
  
  if (!confirm.yes) {
    console.log(chalk.red('\n❌ Deletion cancelled\n'));
    return;
  }
  
  try {
    const deleted = await deletePreset(name!);
    if (deleted) {
      console.log(chalk.green(`\n✅ Preset '${name}' deleted.\n`));
    } else {
      console.log(chalk.yellow(`\nPreset '${name}' not found.\n`));
    }
  } catch (error: any) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
  }
}

async function setDefaultCommand(name?: string, options?: any) {
  const currentDefault = await getDefaultPreset();
  const nonInteractive = isNonInteractive(options);

  if (options?.clear) {
    name = null as any;
  }
  
  if (!name) {
    if (nonInteractive && !options?.clear) {
      console.log(chalk.red('\n❌ Preset name is required in non-interactive mode. Use --clear to clear it.\n'));
      process.exit(1);
    }

    if (options?.clear) {
      // Skip the interactive selector below.
    } else {
    const customPresets = await listPresets();
    const builtinPresets = getBuiltinPresets();
    
    const choices = [
      { title: chalk.gray('(none)'), value: '__none__' },
      ...builtinPresets.map(p => ({ 
        title: `${p}${currentDefault === p ? chalk.green(' (current)') : ''}`, 
        value: p 
      })),
      ...customPresets.map(p => ({ 
        title: `${p.name}${currentDefault === p.name ? chalk.green(' (current)') : ''}`, 
        value: p.name 
      }))
    ];
    
    const response = await prompts({
      type: 'select',
      name: 'name',
      message: 'Select default preset:',
      choices
    });
    
    if (response.name === undefined) {
      console.log(chalk.red('\n❌ Cancelled\n'));
      return;
    }
    
    name = response.name === '__none__' ? null : response.name;
    }
  }
  
  try {
    await setDefaultPreset(name as string | null);
    if (name) {
      console.log(chalk.green(`\n✅ Default preset set to '${name}'.\n`));
      console.log(chalk.gray('New projects will use this preset by default.\n'));
    } else {
      console.log(chalk.green('\n✅ Default preset cleared.\n'));
    }
  } catch (error: any) {
    console.log(chalk.red(`\n❌ ${error.message}\n`));
  }
}

async function showPresetCommand(name?: string) {
  if (!name) {
    console.log(chalk.red('\n❌ Please specify a preset name: nod preset show <name>\n'));
    return;
  }
  
  const presetsConfig = await loadPresetsConfig();
  const preset = presetsConfig.presets[name];
  
  if (!preset && !isBuiltinPreset(name)) {
    console.log(chalk.red(`\n❌ Preset '${name}' not found.\n`));
    return;
  }
  
  console.log(chalk.blue.bold(`\n📦 Preset: ${name}\n`));
  
  if (preset) {
    if (preset.description) {
      console.log(chalk.gray(`Description: ${preset.description}`));
    }
    console.log(chalk.gray(`Created: ${new Date(preset.createdAt).toLocaleDateString()}`));
    console.log(chalk.gray(`Updated: ${new Date(preset.updatedAt).toLocaleDateString()}`));
    console.log('\nConfiguration:');
    console.log(JSON.stringify(preset.config, null, 2));
  } else {
    console.log(chalk.yellow('(Built-in preset - configuration is hardcoded)'));
  }
  
  console.log('');
}

async function showPresetHelp() {
  console.log(chalk.blue.bold('\n📦 Preset Management\n'));
  console.log('Commands:');
  console.log(chalk.cyan('  nod preset list') + '              List all presets');
  console.log(chalk.cyan('  nod preset create [name]') + '     Create a new preset');
  console.log(chalk.cyan('  nod preset delete [name]') + '     Delete a custom preset');
  console.log(chalk.cyan('  nod preset default [name]') + '    Set default preset');
  console.log(chalk.cyan('  nod preset show <name>') + '       Show preset details');
  console.log('');
  console.log('Examples:');
  console.log(chalk.gray('  nod preset create mystack'));
  console.log(chalk.gray('  nod preset default mystack'));
  console.log(chalk.gray('  nod init my-project --preset mystack'));
  console.log('');
}
