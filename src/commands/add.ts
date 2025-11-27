import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { addRoute } from '../generators/route.js';
import { addMiddleware } from '../generators/middleware.js';
import { addService } from '../generators/service.js';
import { generateCronLocks } from '../generators/cron-locks.js';
import { generatePM2Config } from '../generators/pm2.js';
import fs from 'fs-extra';
import path from 'path';

export async function addComponent(component: string, options: any) {
  const validComponents = ['route', 'middleware', 'service', 'controller', 'cron', 'pm2'];
  
  if (!validComponents.includes(component)) {
    console.log(chalk.red(`\n❌ Invalid component: ${component}`));
    console.log(chalk.gray(`Valid components: ${validComponents.join(', ')}\n`));
    process.exit(1);
  }

  // Check if we're in a shiv-am project
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!await fs.pathExists(packageJsonPath)) {
    console.log(chalk.red('\n❌ Not in a Node.js project directory'));
    console.log(chalk.gray('Run this command from your project root\n'));
    process.exit(1);
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const projectName = packageJson.name || 'project';

  // Handle feature additions (cron, pm2)
  if (component === 'cron') {
    const response = await prompts({
      type: 'select',
      name: 'lockBackend',
      message: 'Choose cron lock backend:',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Redis', value: 'redis' },
        { title: 'File-based', value: 'file' }
      ],
      initial: 0
    });

    const spinner = ora('Adding cron support...').start();
    try {
      await generateCronLocks(process.cwd(), response.lockBackend || 'file');
      spinner.succeed(chalk.green('Cron support added successfully!'));
      console.log(chalk.gray('\nCheck PM2_CRON_GUIDE.md for usage instructions\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add cron support'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'pm2') {
    const spinner = ora('Adding PM2 configuration...').start();
    try {
      await generatePM2Config(process.cwd(), projectName);
      spinner.succeed(chalk.green('PM2 configuration added successfully!'));
      console.log(chalk.gray('\nRun: pm2 start ecosystem.config.js\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add PM2 configuration'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  // Handle component additions (route, middleware, service, controller)
  let name = options.name;

  if (!name) {
    const response = await prompts({
      type: 'text',
      name: 'name',
      message: `${component.charAt(0).toUpperCase() + component.slice(1)} name:`
    });
    name = response.name;
  }

  if (!name) {
    console.log(chalk.red('\n❌ Name is required'));
    process.exit(1);
  }

  try {
    switch (component) {
      case 'route':
        await addRoute(name);
        break;
      case 'middleware':
        await addMiddleware(name);
        break;
      case 'service':
        await addService(name);
        break;
      case 'controller':
        console.log(chalk.yellow('Controller generation coming soon!'));
        break;
    }
    
    console.log(chalk.green(`\n✅ ${component} '${name}' added successfully!\n`));
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to add ${component}`));
    console.error(error);
    process.exit(1);
  }
}
