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

export async function presetCommand(action?: string, name?: string) {
  switch (action) {
    case 'list':
    case 'ls':
      await listPresetsCommand();
      break;
    case 'create':
    case 'add':
      await createPresetCommand(name);
      break;
    case 'delete':
    case 'rm':
      await deletePresetCommand(name);
      break;
    case 'default':
      await setDefaultCommand(name);
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

async function createPresetCommand(name?: string) {
  console.log(chalk.blue.bold('\n🔧 Create Custom Preset\n'));
  
  const response = await prompts([
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
        { title: 'None', value: 'none' }
      ],
      initial: 2
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
      name: 'sourceConfig',
      message: 'Include source config (domain-based routing)?',
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
      initial: true
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
      sourceConfig: response.sourceConfig,
      modelConfig: false,
      apiAudit: response.apiAudit,
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

async function deletePresetCommand(name?: string) {
  if (!name) {
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
  
  const confirm = await prompts({
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

async function setDefaultCommand(name?: string) {
  const currentDefault = await getDefaultPreset();
  
  if (!name) {
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
