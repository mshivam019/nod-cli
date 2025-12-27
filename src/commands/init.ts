import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ProjectConfig, Framework, Database, Auth, Queue, Preset } from '../types/index.js';
import { generateProject } from '../generators/project.js';

export async function initProject(name?: string, options?: any) {
  console.log(chalk.blue.bold('\n🚀 Welcome to nod-cli!\n'));

  let config: ProjectConfig;

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
      type: 'select',
      name: 'database',
      message: 'Database:',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'None (e.g., using Supabase/external DB)', value: 'none' }
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
        { title: 'None', value: 'none' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'cron',
      message: 'Include cron jobs support?',
      initial: false
    },
    {
      type: (prev) => prev ? 'select' : null,
      name: 'cronLock',
      message: 'Cron lock backend (for PM2 cluster mode):',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Redis', value: 'redis' },
        { title: 'File-based', value: 'file' }
      ],
      initial: 0
    },
    {
      type: 'select',
      name: 'queue',
      message: 'Job queue:',
      choices: [
        { title: 'BullMQ (Redis-based)', value: 'bull' },
        { title: 'None', value: 'none' }
      ],
      initial: 1
    },
    {
      type: 'confirm',
      name: 'docker',
      message: 'Include Docker configuration?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'pm2',
      message: 'Include PM2 configuration?',
      initial: true
    }
  ]);

  if (!response.name && !name) {
    console.log(chalk.red('\n❌ Setup cancelled'));
    process.exit(1);
  }

  config = {
    name: name || response.name,
    framework: response.framework || 'express',
    typescript: response.typescript !== false,
    database: response.database || 'none',
    auth: response.auth || 'none',
    queue: response.queue || 'none',
    preset: 'custom',
    features: {
      cron: response.cron || false,
      cronLock: response.cronLock || 'file',
      logging: true,
      testing: true,
      docker: response.docker !== false,
      pm2: response.pm2 !== false
    }
  };

  const spinner = ora('Generating project...').start();

  try {
    await generateProject(config);
    spinner.succeed(chalk.green('Project generated successfully!'));
    
    console.log(chalk.blue('\n📦 Next steps:'));
    console.log(chalk.gray(`  cd ${config.name}`));
    console.log(chalk.gray('  npm install'));
    console.log(chalk.gray('  cp .env.example .env'));
    console.log(chalk.gray('  npm run dev\n'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate project'));
    console.error(error);
    process.exit(1);
  }
}
