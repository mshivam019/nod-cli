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
  const validComponents = ['route', 'middleware', 'service', 'controller', 'cron', 'pm2', 'rag', 'chat', 'vercel-cron', 'github-actions', 'supabase', 'drizzle', 'langfuse'];
  
  if (!validComponents.includes(component)) {
    console.log(chalk.red(`\n❌ Invalid component: ${component}`));
    console.log(chalk.gray(`Valid components: ${validComponents.join(', ')}\n`));
    process.exit(1);
  }

  // Check if we're in a project
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!await fs.pathExists(packageJsonPath)) {
    console.log(chalk.red('\n❌ Not in a Node.js project directory'));
    console.log(chalk.gray('Run this command from your project root\n'));
    process.exit(1);
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const projectName = packageJson.name || 'project';
  const isTypeScript = await fs.pathExists(path.join(process.cwd(), 'tsconfig.json'));
  const ext = isTypeScript ? 'ts' : 'js';
  const framework = packageJson.dependencies?.hono ? 'hono' : 'express';

  // Handle feature additions
  if (component === 'cron') {
    const response = await prompts({
      type: 'select',
      name: 'lockBackend',
      message: 'Choose cron lock backend:',
      choices: [
        { title: 'PostgreSQL', value: 'pg' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'Redis', value: 'redis' },
        { title: 'Supabase', value: 'supabase' },
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

  if (component === 'vercel-cron') {
    const spinner = ora('Adding Vercel cron configuration...').start();
    try {
      const { generateVercelConfig, generateVercelCronRoutes, generateCronMiddleware, generateCronService } = await import('../generators/vercel.js');
      await generateVercelConfig(process.cwd(), []);
      await generateVercelCronRoutes(process.cwd(), ext, framework);
      await generateCronMiddleware(process.cwd(), ext);
      await generateCronService(process.cwd(), ext);
      
      // Add dependencies
      packageJson.dependencies = packageJson.dependencies || {};
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Vercel cron configuration added!'));
      console.log(chalk.gray('\n1. Add cron jobs to vercel.json'));
      console.log(chalk.gray('2. Set CRON_SECRET in Vercel environment'));
      console.log(chalk.gray('3. Import cron routes in your app\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add Vercel cron configuration'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'github-actions') {
    const spinner = ora('Adding GitHub Actions workflow for Vercel deployment...').start();
    try {
      const { generateGithubWorkflow } = await import('../generators/github.js');
      await generateGithubWorkflow(process.cwd(), { deployTrigger: true });
      spinner.succeed(chalk.green('GitHub Actions workflow added!'));
      console.log(chalk.gray('\nSet REPO_SECRET in GitHub repository secrets'));
      console.log(chalk.gray('Use --deploy in commit message to trigger deployment\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add GitHub Actions workflow'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'rag') {
    const spinner = ora('Adding RAG service...').start();
    try {
      const { generateRAGService } = await import('../generators/ai.js');
      await generateRAGService(process.cwd(), { name: projectName, ai: { rag: true } } as any, ext);
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@langchain/openai': '^0.0.14',
        '@langchain/core': '^0.1.0',
        '@supabase/supabase-js': '^2.39.0'
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('RAG service added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set OPENAI_API_KEY in .env\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add RAG service'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'chat') {
    const response = await prompts({
      type: 'confirm',
      name: 'langfuse',
      message: 'Include Langfuse for LLM observability?',
      initial: true
    });

    const spinner = ora('Adding Chat service...').start();
    try {
      const { generateChatService } = await import('../generators/ai.js');
      await generateChatService(process.cwd(), { 
        name: projectName, 
        ai: { chat: true, langfuse: response.langfuse } 
      } as any, ext);
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@langchain/openai': '^0.0.14',
        '@langchain/core': '^0.1.0',
        '@supabase/supabase-js': '^2.39.0',
        ...(response.langfuse && { 'langfuse-langchain': '^3.3.0' })
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Chat service added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set OPENAI_API_KEY in .env'));
      if (response.langfuse) {
        console.log(chalk.gray('Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env\n'));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to add Chat service'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'supabase') {
    const response = await prompts({
      type: 'confirm',
      name: 'auth',
      message: 'Include Supabase JWT auth middleware?',
      initial: true
    });

    const spinner = ora('Adding Supabase helper...').start();
    try {
      const { generateSupabaseHelper, generateSupabaseJwtAuth } = await import('../generators/supabase.js');
      await generateSupabaseHelper(process.cwd(), { name: projectName, orm: 'raw' } as any, ext);
      
      if (response.auth) {
        await generateSupabaseJwtAuth(process.cwd(), ext);
        packageJson.dependencies = {
          ...packageJson.dependencies,
          'jose': '^5.2.0'
        };
      }
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@supabase/supabase-js': '^2.39.0'
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Supabase helper added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set SUPABASE_URL and SUPABASE_API_KEY in .env\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add Supabase helper'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'drizzle') {
    const spinner = ora('Adding Drizzle ORM...').start();
    try {
      const { generateSupabaseHelper } = await import('../generators/supabase.js');
      await generateSupabaseHelper(process.cwd(), { 
        name: projectName, 
        orm: 'drizzle',
        supabase: { usePooler: true }
      } as any, ext);
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'drizzle-orm': '^0.29.0',
        'postgres': '^3.4.0',
        '@supabase/supabase-js': '^2.39.0'
      };
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'drizzle-kit': '^0.20.0'
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Drizzle ORM added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set DATABASE_URL or SUPABASE_POOLER_URL in .env'));
      console.log(chalk.gray('npx drizzle-kit generate'));
      console.log(chalk.gray('npx drizzle-kit push\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add Drizzle ORM'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'langfuse') {
    const spinner = ora('Adding Langfuse integration...').start();
    try {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'langfuse-langchain': '^3.3.0'
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Langfuse dependency added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env'));
      console.log(chalk.gray('Import and use langfuseHandler in your LLM calls\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add Langfuse'));
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
