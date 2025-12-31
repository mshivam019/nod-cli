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
      console.log(chalk.gray('3. Import cron routes in your app'));
      console.log(chalk.blue('\n📚 Vercel Cron docs: https://vercel.com/docs/cron-jobs\n'));
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
      console.log(chalk.gray('Use --deploy in commit message to trigger deployment'));
      console.log(chalk.blue('\n📚 GitHub Actions docs: https://docs.github.com/en/actions\n'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add GitHub Actions workflow'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'rag') {
    // Ask for embedding provider
    const embeddingResponse = await prompts({
      type: 'select',
      name: 'embeddingProvider',
      message: 'Choose embedding provider:',
      choices: [
        { title: 'OpenAI (text-embedding-3-small)', value: 'openai' },
        { title: 'Google Gemini (embedding-001)', value: 'gemini' },
        { title: 'Cohere (embed-english-v3.0)', value: 'cohere' }
      ],
      initial: 0
    });

    if (!embeddingResponse.embeddingProvider) {
      console.log(chalk.red('\n❌ Setup cancelled'));
      process.exit(1);
    }

    // Ask for vector store
    const vectorStoreResponse = await prompts({
      type: 'select',
      name: 'vectorStore',
      message: 'Choose vector store:',
      choices: [
        { title: 'Supabase (pgvector)', value: 'supabase' },
        { title: 'Pinecone', value: 'pinecone' },
        { title: 'Chroma (local/self-hosted)', value: 'chroma' },
        { title: 'Weaviate', value: 'weaviate' }
      ],
      initial: 0
    });

    if (!vectorStoreResponse.vectorStore) {
      console.log(chalk.red('\n❌ Setup cancelled'));
      process.exit(1);
    }

    // Ask if they want routes and controllers
    const generateRoutesResponse = await prompts({
      type: 'confirm',
      name: 'generateRoutes',
      message: 'Generate RAG routes and controller?',
      initial: true
    });

    const spinner = ora('Adding RAG service...').start();
    try {
      const { generateRAGService, generateRAGSchema, generateRAGRoutes, generateRAGController } = await import('../generators/ai.js');
      
      const ragConfig = {
        embeddingProvider: embeddingResponse.embeddingProvider,
        vectorStore: vectorStoreResponse.vectorStore
      };
      
      await generateRAGService(process.cwd(), { 
        name: projectName, 
        ai: { 
          rag: true, 
          embeddings: ragConfig.embeddingProvider,
          vectorStore: ragConfig.vectorStore
        } 
      } as any, ext);
      
      // Generate schema
      await generateRAGSchema(process.cwd(), ragConfig.vectorStore, ext);
      
      // Generate routes and controller if requested
      if (generateRoutesResponse.generateRoutes) {
        await generateRAGRoutes(process.cwd(), framework, ext);
        await generateRAGController(process.cwd(), ext);
      }
      
      // Add dependencies based on selections
      const deps: Record<string, string> = {
        '@langchain/core': '^0.3.0'
      };
      
      // Embedding provider dependencies
      if (ragConfig.embeddingProvider === 'openai') {
        deps['@langchain/openai'] = '^0.3.0';
      } else if (ragConfig.embeddingProvider === 'gemini') {
        deps['@langchain/google-genai'] = '^0.1.0';
      } else if (ragConfig.embeddingProvider === 'cohere') {
        deps['@langchain/cohere'] = '^0.3.0';
      }
      
      // Vector store dependencies
      if (ragConfig.vectorStore === 'supabase') {
        deps['@supabase/supabase-js'] = '^2.39.0';
      } else if (ragConfig.vectorStore === 'pinecone') {
        deps['@pinecone-database/pinecone'] = '^2.0.0';
        deps['@langchain/pinecone'] = '^0.1.0';
      } else if (ragConfig.vectorStore === 'chroma') {
        deps['chromadb'] = '^1.7.0';
        deps['@langchain/community'] = '^0.3.0';
      } else if (ragConfig.vectorStore === 'weaviate') {
        deps['weaviate-ts-client'] = '^2.0.0';
        deps['@langchain/weaviate'] = '^0.1.0';
      }
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...deps
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('RAG service added!'));
      console.log(chalk.gray('\nnpm install'));
      
      // Provider-specific instructions
      if (ragConfig.embeddingProvider === 'openai') {
        console.log(chalk.gray('Set OPENAI_API_KEY in .env'));
      } else if (ragConfig.embeddingProvider === 'gemini') {
        console.log(chalk.gray('Set GOOGLE_API_KEY in .env'));
      } else if (ragConfig.embeddingProvider === 'cohere') {
        console.log(chalk.gray('Set COHERE_API_KEY in .env'));
      }
      
      // Vector store-specific instructions
      if (ragConfig.vectorStore === 'supabase') {
        console.log(chalk.gray('Set SUPABASE_URL and SUPABASE_API_KEY in .env'));
        console.log(chalk.yellow('\n📝 Run the SQL schema in sql/rag-schema.sql in your Supabase dashboard'));
        console.log(chalk.blue('📚 Supabase pgvector docs: https://supabase.com/docs/guides/ai/vector-columns'));
      } else if (ragConfig.vectorStore === 'pinecone') {
        console.log(chalk.gray('Set PINECONE_API_KEY and PINECONE_INDEX in .env'));
        console.log(chalk.blue('📚 Pinecone docs: https://docs.pinecone.io/guides/getting-started/overview'));
      } else if (ragConfig.vectorStore === 'chroma') {
        console.log(chalk.gray('Set CHROMA_URL in .env (default: http://localhost:8000)'));
        console.log(chalk.blue('📚 Chroma docs: https://docs.trychroma.com/getting-started'));
      } else if (ragConfig.vectorStore === 'weaviate') {
        console.log(chalk.gray('Set WEAVIATE_URL and WEAVIATE_API_KEY in .env'));
        console.log(chalk.blue('📚 Weaviate docs: https://weaviate.io/developers/weaviate'));
      }
      
      // Documentation links
      console.log(chalk.blue('\n📚 LangChain RAG docs: https://js.langchain.com/docs/tutorials/rag'));
      
      if (generateRoutesResponse.generateRoutes) {
        console.log(chalk.yellow('\n📝 Import RAG routes in your app:'));
        if (framework === 'express') {
          console.log(chalk.gray(`  import ragRoutes from './routes/rag.routes.js';`));
          console.log(chalk.gray(`  app.use('/api/rag', ragRoutes);`));
        } else {
          console.log(chalk.gray(`  import ragRoutes from './routes/rag.routes.js';`));
          console.log(chalk.gray(`  app.route('/api/rag', ragRoutes);`));
        }
      }
      console.log('');
      process.exit(0);
    } catch (error) {
      spinner.fail(chalk.red('Failed to add RAG service'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  if (component === 'chat') {
    // Ask for LLM provider
    const llmResponse = await prompts({
      type: 'select',
      name: 'llmProvider',
      message: 'Choose LLM provider:',
      choices: [
        { title: 'OpenAI (GPT-4o, GPT-4o-mini)', value: 'openai' },
        { title: 'Anthropic (Claude 3.5)', value: 'anthropic' },
        { title: 'Google Gemini (Gemini Pro)', value: 'gemini' }
      ],
      initial: 0
    });

    if (!llmResponse.llmProvider) {
      console.log(chalk.red('\n❌ Setup cancelled'));
      process.exit(1);
    }

    // Ask for database to store conversations
    const dbResponse = await prompts({
      type: 'select',
      name: 'chatDatabase',
      message: 'Choose database for chat history:',
      choices: [
        { title: 'Supabase (PostgreSQL)', value: 'supabase' },
        { title: 'PostgreSQL (direct)', value: 'pg' },
        { title: 'MySQL', value: 'mysql' }
      ],
      initial: 0
    });

    if (!dbResponse.chatDatabase) {
      console.log(chalk.red('\n❌ Setup cancelled'));
      process.exit(1);
    }

    // Ask about Langfuse
    const langfuseResponse = await prompts({
      type: 'confirm',
      name: 'langfuse',
      message: 'Include Langfuse for LLM observability?',
      initial: true
    });

    // Ask if they want routes and controllers
    const generateRoutesResponse = await prompts({
      type: 'confirm',
      name: 'generateRoutes',
      message: 'Generate Chat routes and controller?',
      initial: true
    });

    const spinner = ora('Adding Chat service...').start();
    try {
      const { generateChatService, generateChatSchema, generateChatRoutes, generateChatController } = await import('../generators/ai.js');
      
      const chatConfig = {
        llmProvider: llmResponse.llmProvider,
        chatDatabase: dbResponse.chatDatabase,
        langfuse: langfuseResponse.langfuse
      };
      
      await generateChatService(process.cwd(), { 
        name: projectName, 
        ai: { 
          chat: true, 
          langfuse: chatConfig.langfuse,
          llmProvider: chatConfig.llmProvider,
          chatDatabase: chatConfig.chatDatabase
        } 
      } as any, ext);
      
      // Generate schema
      await generateChatSchema(process.cwd(), chatConfig.chatDatabase, ext);
      
      // Generate routes and controller if requested
      if (generateRoutesResponse.generateRoutes) {
        await generateChatRoutes(process.cwd(), framework, ext);
        await generateChatController(process.cwd(), chatConfig.llmProvider, ext);
      }
      
      // Add dependencies based on selections
      const deps: Record<string, string> = {
        '@langchain/core': '^0.3.0'
      };
      
      // LLM provider dependencies
      if (chatConfig.llmProvider === 'openai') {
        deps['@langchain/openai'] = '^0.3.0';
      } else if (chatConfig.llmProvider === 'anthropic') {
        deps['@langchain/anthropic'] = '^0.3.0';
      } else if (chatConfig.llmProvider === 'gemini') {
        deps['@langchain/google-genai'] = '^0.1.0';
      }
      
      // Database dependencies
      if (chatConfig.chatDatabase === 'supabase') {
        deps['@supabase/supabase-js'] = '^2.39.0';
      } else if (chatConfig.chatDatabase === 'pg') {
        deps['pg'] = '^8.11.0';
      } else if (chatConfig.chatDatabase === 'mysql') {
        deps['mysql2'] = '^3.6.0';
      }
      
      // Langfuse
      if (chatConfig.langfuse) {
        deps['langfuse-langchain'] = '^3.3.0';
        deps['langchain'] = '^0.3.0'; // Required peer dependency for langfuse-langchain
      }
      
      // Database dependencies
      if (chatConfig.chatDatabase === 'supabase') {
        deps['@supabase/supabase-js'] = '^2.39.0';
      } else if (chatConfig.chatDatabase === 'pg') {
        deps['pg'] = '^8.11.0';
      } else if (chatConfig.chatDatabase === 'mysql') {
        deps['mysql2'] = '^3.6.0';
      }
      
      // Langfuse
      if (chatConfig.langfuse) {
        deps['langfuse-langchain'] = '^3.3.0';
      }
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...deps
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Chat service added!'));
      console.log(chalk.gray('\nnpm install'));
      
      // Provider-specific instructions
      if (chatConfig.llmProvider === 'openai') {
        console.log(chalk.gray('Set OPENAI_API_KEY in .env'));
      } else if (chatConfig.llmProvider === 'anthropic') {
        console.log(chalk.gray('Set ANTHROPIC_API_KEY in .env'));
      } else if (chatConfig.llmProvider === 'gemini') {
        console.log(chalk.gray('Set GOOGLE_API_KEY in .env'));
      }
      
      // Database-specific instructions
      if (chatConfig.chatDatabase === 'supabase') {
        console.log(chalk.gray('Set SUPABASE_URL and SUPABASE_API_KEY in .env'));
        console.log(chalk.yellow('\n📝 Run the SQL schema in sql/chat-schema.sql in your Supabase dashboard'));
      } else if (chatConfig.chatDatabase === 'pg') {
        console.log(chalk.gray('Set DATABASE_URL in .env'));
        console.log(chalk.yellow('\n📝 Run the SQL schema in sql/chat-schema.sql'));
      } else if (chatConfig.chatDatabase === 'mysql') {
        console.log(chalk.gray('Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE in .env'));
        console.log(chalk.yellow('\n📝 Run the SQL schema in sql/chat-schema.sql'));
      }
      
      if (chatConfig.langfuse) {
        console.log(chalk.gray('Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env'));
        console.log(chalk.blue('📚 Langfuse docs: https://langfuse.com/docs'));
      }
      
      // Documentation links
      console.log(chalk.blue('\n📚 LangChain Chat docs: https://js.langchain.com/docs/tutorials/chatbot'));
      
      if (generateRoutesResponse.generateRoutes) {
        console.log(chalk.yellow('\n📝 Import Chat routes in your app:'));
        if (framework === 'express') {
          console.log(chalk.gray(`  import chatRoutes from './routes/chat.routes.js';`));
          console.log(chalk.gray(`  app.use('/api/chat', chatRoutes);`));
        } else {
          console.log(chalk.gray(`  import chatRoutes from './routes/chat.routes.js';`));
          console.log(chalk.gray(`  app.route('/api/chat', chatRoutes);`));
        }
      }
      console.log('');
      process.exit(0);
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
      console.log(chalk.gray('Set SUPABASE_URL and SUPABASE_API_KEY in .env'));
      console.log(chalk.blue('\n📚 Supabase docs: https://supabase.com/docs\n'));
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
      console.log(chalk.gray('npx drizzle-kit push'));
      console.log(chalk.blue('\n📚 Drizzle docs: https://orm.drizzle.team/docs/overview\n'));
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
      console.log(chalk.gray('Import and use langfuseHandler in your LLM calls'));
      console.log(chalk.blue('\n📚 Langfuse docs: https://langfuse.com/docs\n'));
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
