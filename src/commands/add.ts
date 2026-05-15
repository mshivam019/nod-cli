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
import { DEPENDENCIES, DEV_DEPENDENCIES } from '../utils/dependencies.js';

const CRON_LOCK_VALUES = ['pg', 'mysql', 'redis', 'supabase', 'file'] as const;
const EMBEDDING_VALUES = ['openai', 'gemini', 'cohere'] as const;
const VECTOR_STORE_VALUES = ['supabase', 'pinecone', 'chroma', 'weaviate'] as const;
const LLM_VALUES = ['openai', 'anthropic', 'gemini'] as const;
const CHAT_DB_VALUES = ['supabase', 'pg', 'mysql'] as const;
const AUTH_MODE_VALUES = ['email-password', 'oauth-only', 'both'] as const;
const ROUTE_METHOD_VALUES = ['get', 'post', 'put', 'delete', 'patch'] as const;
const ROUTE_MIDDLEWARE_VALUES = ['authMiddleware', 'loggingMiddleware', 'roleMiddleware'] as const;

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

function parseListOption(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function addComponent(component: string, options: any) {
  const isNonInteractive = options?.yes || process.env.CI === 'true';
  const validComponents = ['route', 'middleware', 'service', 'controller', 'cron', 'pm2', 'rag', 'chat', 'vercel-cron', 'github-actions', 'supabase', 'drizzle', 'langfuse', 'auth', 'cors'];
  
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
    const selectedLockBackend = parseEnumOption(options?.lockBackend, CRON_LOCK_VALUES, '--lock-backend');
    let lockBackend = selectedLockBackend;

    if (!lockBackend && !isNonInteractive) {
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
      lockBackend = response.lockBackend;
    }

    const spinner = ora('Adding cron support...').start();
    try {
      await generateCronLocks(process.cwd(), lockBackend || 'file');
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

  if (component === 'cors') {
    const spinner = ora('Adding CORS middleware component...').start();
    try {
      await addMiddleware('cors', { type: 'cors', isDefault: true });
      spinner.succeed(chalk.green('CORS middleware added and applied as default!'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to add CORS middleware'));
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
    let embeddingProvider = parseEnumOption(options?.embeddingProvider, EMBEDDING_VALUES, '--embedding-provider');
    let vectorStore = parseEnumOption(options?.vectorStore, VECTOR_STORE_VALUES, '--vector-store');
    let generateRoutes = parseBooleanOption(options?.generateRoutes, '--generate-routes');

    if (!isNonInteractive) {
      if (!embeddingProvider) {
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
        embeddingProvider = embeddingResponse.embeddingProvider;
      }

      if (!vectorStore) {
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
        vectorStore = vectorStoreResponse.vectorStore;
      }

      if (generateRoutes === undefined) {
        const generateRoutesResponse = await prompts({
          type: 'confirm',
          name: 'generateRoutes',
          message: 'Generate RAG routes and controller?',
          initial: true
        });
        generateRoutes = generateRoutesResponse.generateRoutes;
      }
    }

    const ragConfig = {
      embeddingProvider: embeddingProvider || 'openai',
      vectorStore: vectorStore || 'supabase',
      generateRoutes: generateRoutes ?? true
    };

    const spinner = ora('Adding RAG service...').start();
    try {
      const { generateRAGService, generateRAGSchema, generateRAGRoutes, generateRAGController } = await import('../generators/ai.js');
      
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
      if (ragConfig.generateRoutes) {
        await generateRAGRoutes(process.cwd(), framework, ext);
        await generateRAGController(process.cwd(), ext);
      }
      
      // Add dependencies based on selections
      const deps: Record<string, string> = {
        '@langchain/core': DEPENDENCIES.langchainCore
      };
      
      // Embedding provider dependencies
      if (ragConfig.embeddingProvider === 'openai') {
        deps['@langchain/openai'] = DEPENDENCIES.langchainOpenai;
      } else if (ragConfig.embeddingProvider === 'gemini') {
        deps['@langchain/google-genai'] = DEPENDENCIES.langchainGoogleGenai;
      } else if (ragConfig.embeddingProvider === 'cohere') {
        deps['@langchain/cohere'] = DEPENDENCIES.langchainCohere;
      }
      
      // Vector store dependencies
      if (ragConfig.vectorStore === 'supabase') {
        deps['@supabase/supabase-js'] = DEPENDENCIES.supabase;
      } else if (ragConfig.vectorStore === 'pinecone') {
        deps['@pinecone-database/pinecone'] = DEPENDENCIES.pinecone;
        deps['@langchain/pinecone'] = DEPENDENCIES.langchainPinecone;
      } else if (ragConfig.vectorStore === 'chroma') {
        deps['chromadb'] = DEPENDENCIES.chromadb;
        deps['@langchain/community'] = DEPENDENCIES.langchainCommunity;
      } else if (ragConfig.vectorStore === 'weaviate') {
        deps['weaviate-ts-client'] = DEPENDENCIES.weaviate;
        deps['@langchain/weaviate'] = DEPENDENCIES.langchainWeaviate;
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
      
      if (ragConfig.generateRoutes) {
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
    let llmProvider = parseEnumOption(options?.llmProvider, LLM_VALUES, '--llm-provider');
    let chatDatabase = parseEnumOption(options?.chatDatabase, CHAT_DB_VALUES, '--chat-database');
    let langfuse = parseBooleanOption(options?.langfuse, '--langfuse');
    let generateRoutes = parseBooleanOption(options?.generateRoutes, '--generate-routes');

    if (!isNonInteractive) {
      if (!llmProvider) {
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
        llmProvider = llmResponse.llmProvider;
      }

      if (!chatDatabase) {
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
        chatDatabase = dbResponse.chatDatabase;
      }

      if (langfuse === undefined) {
        const langfuseResponse = await prompts({
          type: 'confirm',
          name: 'langfuse',
          message: 'Include Langfuse for LLM observability?',
          initial: true
        });
        langfuse = langfuseResponse.langfuse;
      }

      if (generateRoutes === undefined) {
        const generateRoutesResponse = await prompts({
          type: 'confirm',
          name: 'generateRoutes',
          message: 'Generate Chat routes and controller?',
          initial: true
        });
        generateRoutes = generateRoutesResponse.generateRoutes;
      }
    }

    const chatConfig = {
      llmProvider: llmProvider || 'openai',
      chatDatabase: chatDatabase || 'supabase',
      langfuse: langfuse ?? true,
      generateRoutes: generateRoutes ?? true
    };

    const spinner = ora('Adding Chat service...').start();
    try {
      const { generateChatService, generateChatSchema, generateChatRoutes, generateChatController } = await import('../generators/ai.js');
      
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
      if (chatConfig.generateRoutes) {
        await generateChatRoutes(process.cwd(), framework, ext);
        await generateChatController(process.cwd(), chatConfig.llmProvider, ext);
      }
      
      // Add dependencies based on selections
      const deps: Record<string, string> = {
        '@langchain/core': DEPENDENCIES.langchainCore
      };
      
      // LLM provider dependencies
      if (chatConfig.llmProvider === 'openai') {
        deps['@langchain/openai'] = DEPENDENCIES.langchainOpenai;
      } else if (chatConfig.llmProvider === 'anthropic') {
        deps['@langchain/anthropic'] = DEPENDENCIES.langchainAnthropic;
      } else if (chatConfig.llmProvider === 'gemini') {
        deps['@langchain/google-genai'] = DEPENDENCIES.langchainGoogleGenai;
      }
      
      // Database dependencies
      if (chatConfig.chatDatabase === 'supabase') {
        deps['@supabase/supabase-js'] = DEPENDENCIES.supabase;
      } else if (chatConfig.chatDatabase === 'pg') {
        deps['pg'] = DEPENDENCIES.pg;
      } else if (chatConfig.chatDatabase === 'mysql') {
        deps['mysql2'] = DEPENDENCIES.mysql2;
      }
      
      // Langfuse
      if (chatConfig.langfuse) {
        deps['@langfuse/langchain'] = DEPENDENCIES.langfuseLangchainModern;
        deps['@langfuse/core'] = DEPENDENCIES.langfuseCore;
        deps['@langfuse/otel'] = DEPENDENCIES.langfuseOtel;
        deps['@opentelemetry/sdk-node'] = DEPENDENCIES.opentelemetrySdkNode;
        deps['langchain'] = DEPENDENCIES.langchain;
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
      
      if (chatConfig.generateRoutes) {
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
    let includeAuth = parseBooleanOption(options?.supabaseAuth, '--supabase-auth');
    if (includeAuth === undefined && !isNonInteractive) {
      const response = await prompts({
        type: 'confirm',
        name: 'auth',
        message: 'Include Supabase JWT auth middleware?',
        initial: true
      });
      includeAuth = response.auth;
    }

    const spinner = ora('Adding Supabase helper...').start();
    try {
      const { generateSupabaseHelper, generateSupabaseJwtAuth } = await import('../generators/supabase.js');
      await generateSupabaseHelper(process.cwd(), { name: projectName, orm: 'raw' } as any, ext);
      
      if (includeAuth ?? true) {
        await generateSupabaseJwtAuth(process.cwd(), ext);
        packageJson.dependencies = {
          ...packageJson.dependencies,
          'jose': DEPENDENCIES.jose
        };
      }
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@supabase/supabase-js': DEPENDENCIES.supabase
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
        'drizzle-orm': DEPENDENCIES.drizzleOrm,
        'postgres': DEPENDENCIES.postgres,
        '@supabase/supabase-js': DEPENDENCIES.supabase
      };
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'drizzle-kit': DEV_DEPENDENCIES.drizzleKit
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green('Drizzle ORM added!'));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.gray('Set DATABASE_URL or SUPABASE_POOLER_URL in .env'));
      const drizzleConfigFile = isTypeScript ? 'drizzle.config.ts' : 'drizzle.config.js';
      console.log(chalk.gray(`npx drizzle-kit generate --config=${drizzleConfigFile}`));
      console.log(chalk.gray(`npx drizzle-kit migrate --config=${drizzleConfigFile}`));
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
      const { generateLangfuseObservability } = await import('../generators/observability.js');
      await generateLangfuseObservability(process.cwd(), { name: projectName } as any, ext);
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@langfuse/langchain': DEPENDENCIES.langfuseLangchainModern,
        '@langfuse/core': DEPENDENCIES.langfuseCore,
        '@langfuse/otel': DEPENDENCIES.langfuseOtel,
        '@opentelemetry/sdk-node': DEPENDENCIES.opentelemetrySdkNode,
        '@langchain/core': DEPENDENCIES.langchainCore,
        'langchain': DEPENDENCIES.langchain
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

  if (component === 'auth') {
    let authMode = parseEnumOption(options?.authMode, AUTH_MODE_VALUES, '--auth-mode');
    if (!authMode && !isNonInteractive) {
      const modeResponse = await prompts({
        type: 'select',
        name: 'authMode',
        message: 'Authentication mode:',
        choices: [
          { title: 'Email/Password + OAuth', value: 'both', description: 'Traditional login + social providers' },
          { title: 'Email/Password only', value: 'email-password', description: 'Traditional email/password login' },
          { title: 'OAuth only', value: 'oauth-only', description: 'Social login only (Google, etc.)' }
        ],
        initial: 0
      });
      authMode = modeResponse.authMode;
    }

    if (!authMode) {
      authMode = 'both';
    }

    const needsPassword = authMode === 'email-password' || authMode === 'both';
    const needsOAuth = authMode === 'oauth-only' || authMode === 'both';

    const nonInteractiveFeatures = {
      supabaseAdmin: parseBooleanOption(options?.supabaseAdmin, '--supabase-admin') ?? true,
      customJwt: parseBooleanOption(options?.customJwt, '--custom-jwt') ?? true,
      jwks: parseBooleanOption(options?.jwks, '--jwks') ?? true,
      forgotPassword: needsPassword ? (parseBooleanOption(options?.forgotPassword, '--forgot-password') ?? true) : false,
      googleOAuth: needsOAuth ? (parseBooleanOption(options?.googleOAuth, '--google-oauth') ?? true) : false,
      emailService: needsPassword ? (parseBooleanOption(options?.emailService, '--email-service') ?? true) : false
    };

    const featuresResponse = isNonInteractive
      ? nonInteractiveFeatures
      : await prompts([
          {
            type: 'confirm',
            name: 'supabaseAdmin',
            message: 'Include Supabase Admin auth (for when signups are disabled)?',
            initial: true
          },
          {
            type: 'confirm',
            name: 'customJwt',
            message: 'Include custom JWT signing (roll your own tokens)?',
            initial: true
          },
          {
            type: 'confirm',
            name: 'jwks',
            message: 'Include JWKS auto-generation (/.well-known/jwks.json endpoint)?',
            initial: true
          },
          {
            type: needsPassword ? 'confirm' : null,
            name: 'forgotPassword',
            message: 'Include forgot password flow?',
            initial: true
          },
          {
            type: needsOAuth ? 'confirm' : null,
            name: 'googleOAuth',
            message: 'Include Google OAuth (server-side verification)?',
            initial: true
          },
          {
            type: needsPassword ? 'confirm' : null,
            name: 'emailService',
            message: 'Include email service (nodemailer for password reset emails)?',
            initial: true
          }
        ]);

    if (!featuresResponse || featuresResponse.customJwt === undefined) {
      console.log(chalk.red('\n❌ Setup cancelled'));
      process.exit(1);
    }

    const spinner = ora('Adding auth module...').start();
    try {
      const { generateAuth } = await import('../generators/auth.js');
      
      await generateAuth(process.cwd(), {
        supabaseAdmin: featuresResponse.supabaseAdmin,
        customJwt: featuresResponse.customJwt,
        jwks: featuresResponse.jwks,
        forgotPassword: needsPassword ? featuresResponse.forgotPassword : false,
        googleOAuth: needsOAuth ? featuresResponse.googleOAuth : false,
        emailService: needsPassword ? featuresResponse.emailService : false,
        authMode,
        framework
      }, ext);
      
      // Add dependencies
      const deps: Record<string, string> = {
        'jose': DEPENDENCIES.jose
      };
      
      // Only add bcrypt if using password auth
      if (needsPassword) {
        deps['bcryptjs'] = DEPENDENCIES.bcryptjs;
      }
      
      if (featuresResponse.supabaseAdmin) {
        deps['@supabase/supabase-js'] = DEPENDENCIES.supabase;
      }
      
      if (needsPassword && featuresResponse.emailService) {
        deps['nodemailer'] = DEPENDENCIES.nodemailer;
      }
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...deps
      };
      
      // Add TypeScript types for password-related deps
      if (isTypeScript) {
        const devDeps: Record<string, string> = {};
        if (needsPassword) {
          devDeps['@types/bcryptjs'] = DEV_DEPENDENCIES.typesBcryptjs;
          if (featuresResponse.emailService) {
            devDeps['@types/nodemailer'] = DEV_DEPENDENCIES.typesNodemailer;
          }
        }
        if (Object.keys(devDeps).length > 0) {
          packageJson.devDependencies = {
            ...packageJson.devDependencies,
            ...devDeps
          };
        }
      }
      
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      spinner.succeed(chalk.green(`Auth module added! (mode: ${authMode})`));
      console.log(chalk.gray('\nnpm install'));
      console.log(chalk.yellow('\n📁 Generated files:'));
      console.log(chalk.gray('  src/auth/jwks.service.ts       - JWKS auto-generation'));
      console.log(chalk.gray('  src/auth/jwt.service.ts        - Custom JWT signing/verification'));
      if (needsPassword) {
        console.log(chalk.gray('  src/auth/password.service.ts   - Password hashing with bcryptjs'));
      }
      console.log(chalk.gray('  src/auth/auth.service.ts       - Main auth orchestration'));
      console.log(chalk.gray('  src/auth/auth.controller.ts    - Route handlers'));
      console.log(chalk.gray('  src/auth/auth.routes.ts        - Auth routes'));
      console.log(chalk.gray('  src/middleware/auth.middleware.ts - JWT verification middleware'));
      
      if (featuresResponse.supabaseAdmin) {
        console.log(chalk.gray('  src/auth/supabase-admin.service.ts - Supabase Admin API'));
      }
      if (featuresResponse.forgotPassword) {
        console.log(chalk.gray('  src/auth/forgot-password.service.ts - Password reset flow'));
      }
      if (featuresResponse.googleOAuth) {
        console.log(chalk.gray('  src/auth/google-oauth.service.ts - Google OAuth verification'));
      }
      if (featuresResponse.emailService) {
        console.log(chalk.gray('  src/auth/email.service.ts      - Email service with templates'));
      }
      
      // Check for Drizzle to show appropriate schema file
      const hasDrizzle = packageJson.dependencies?.['drizzle-orm'];
      if (hasDrizzle) {
        console.log(chalk.gray('  src/db/schema/auth.ts          - Drizzle auth schema'));
      } else {
        console.log(chalk.gray('  sql/auth-schema.sql            - Database schema'));
      }
      
      console.log(chalk.yellow('\n⚙️  Environment variables needed:'));
      console.log(chalk.gray('  JWT_ISSUER, JWT_AUDIENCE'));
      if (featuresResponse.supabaseAdmin) {
        console.log(chalk.gray('  SUPABASE_URL, SUPABASE_API_KEY, SUPABASE_SERVICE_ROLE_KEY'));
      }
      if (featuresResponse.googleOAuth) {
        console.log(chalk.gray('  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET'));
      }
      if (featuresResponse.emailService) {
        console.log(chalk.gray('  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL'));
      }
      
      // Database schema instructions
      console.log(chalk.yellow('\n🗄️  Database setup:'));
      if (hasDrizzle) {
        console.log(chalk.gray('  1. Review src/db/schema/auth.ts'));
        console.log(chalk.gray('  2. Run: npx drizzle-kit generate'));
        console.log(chalk.gray('  3. Run: npx drizzle-kit migrate'));
      } else {
        console.log(chalk.gray('  Run sql/auth-schema.sql in your database'));
      }
      
      console.log(chalk.yellow('\n📝 Import auth routes in your app:'));
      if (framework === 'express') {
        console.log(chalk.gray(`  import authRoutes from './auth/auth.routes.js';`));
        console.log(chalk.gray(`  import { initializeJWKS } from './auth/jwks.service.js';`));
        console.log(chalk.gray(`  await initializeJWKS(); // Call before starting server`));
        console.log(chalk.gray(`  app.use('/api/auth', authRoutes);`));
      } else {
        console.log(chalk.gray(`  import authRoutes from './auth/auth.routes.js';`));
        console.log(chalk.gray(`  import { initializeJWKS } from './auth/jwks.service.js';`));
        console.log(chalk.gray(`  await initializeJWKS(); // Call before starting server`));
        console.log(chalk.gray(`  app.route('/api/auth', authRoutes);`));
      }
      
      console.log(chalk.yellow('\n🔑 JWKS endpoint: GET /api/auth/.well-known/jwks.json'));
      console.log(chalk.blue('\n📚 Docs: https://nod-cli.dev/docs/components/auth\n'));
      
      process.exit(0);
    } catch (error) {
      spinner.fail(chalk.red('Failed to add auth module'));
      console.error(error);
      process.exit(1);
    }
    return;
  }

  // Handle component additions (route, middleware, service, controller)
  let name = options.name;

  if (!name && isNonInteractive) {
    console.log(chalk.red('\n❌ Name is required in non-interactive mode. Use --name <name>\n'));
    process.exit(1);
  }

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
      case 'route': {
        const middlewareList = parseListOption(options?.middleware);
        if (middlewareList) {
          const invalidMiddleware = middlewareList.filter(
            (item) => !(ROUTE_MIDDLEWARE_VALUES as readonly string[]).includes(item)
          );
          if (invalidMiddleware.length > 0) {
            console.log(chalk.red(`\n❌ Invalid --middleware values: ${invalidMiddleware.join(', ')}`));
            console.log(chalk.gray(`Valid values: ${ROUTE_MIDDLEWARE_VALUES.join(', ')}\n`));
            process.exit(1);
          }
        }

        await addRoute(name, {
          nonInteractive: isNonInteractive,
          method: parseEnumOption(options?.method, ROUTE_METHOD_VALUES, '--method'),
          path: options?.path,
          createController: parseBooleanOption(options?.createController, '--create-controller'),
          createService: parseBooleanOption(options?.createService, '--create-service'),
          middleware: middlewareList
        });
        break;
      }
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
