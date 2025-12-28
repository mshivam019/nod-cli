#!/usr/bin/env node
import { Command } from 'commander';
import { initProject } from './commands/init.js';
import { addComponent } from './commands/add.js';
import { validateCommand } from './commands/validate.js';
import { transformProject } from './commands/transform.js';
import { presetCommand } from './commands/preset.js';

const program = new Command();

program
  .name('nod-cli')
  .description('Backend scaffolding CLI with best practices built-in')
  .version('0.3.0');

program
  .command('init [name]')
  .description('Initialize a new project')
  .option('--framework <framework>', 'Framework: express or hono', 'express')
  .option('--ts', 'Use TypeScript', true)
  .option('--no-ts', 'Use JavaScript')
  .option('--db <database>', 'Database: pg, mysql, supabase, drizzle, or none', 'pg')
  .option('--auth <auth>', 'Auth: jwt, jwks, supabase, or none', 'jwt')
  .option('--queue <queue>', 'Queue: bull or none', 'none')
  .option('--preset <preset>', 'Preset: minimal, api, full, ai, 1, or custom preset name')
  .option('-y, --yes', 'Skip prompts and use defaults/provided options')
  .action(initProject);

// Also allow `nod <name>` as shorthand for `nod init <name>`
program
  .argument('[name]', 'Project name (shorthand for nod init)')
  .option('--framework <framework>', 'Framework: express or hono', 'express')
  .option('--ts', 'Use TypeScript', true)
  .option('--no-ts', 'Use JavaScript')
  .option('--db <database>', 'Database: pg, mysql, supabase, drizzle, or none', 'pg')
  .option('--auth <auth>', 'Auth: jwt, jwks, supabase, or none', 'jwt')
  .option('--queue <queue>', 'Queue: bull or none', 'none')
  .option('--preset <preset>', 'Preset: minimal, api, full, ai, 1, or custom preset name')
  .option('-y, --yes', 'Skip prompts and use defaults/provided options')
  .action((name, options) => {
    // Only run if name is provided and it's not a subcommand
    if (name && !['init', 'add', 'transform', 'validate', 'preset'].includes(name)) {
      initProject(name, options);
    }
  });

program
  .command('add <component>')
  .description('Add a component: route, middleware, service, controller, cron, pm2, rag, chat, vercel-cron, github-actions, supabase, drizzle, langfuse')
  .option('-n, --name <name>', 'Component name (for route/middleware/service/controller)')
  .action(addComponent);

program
  .command('transform')
  .description('Transform existing project with nod features')
  .action(transformProject);

program
  .command('validate')
  .description('Validate project structure and dependencies')
  .action(validateCommand);

program
  .command('preset [action] [name]')
  .description('Manage presets: list, create, delete, default, show')
  .action(presetCommand);

program.parse();
