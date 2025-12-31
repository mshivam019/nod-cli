import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

export async function transformProject(options: any) {
  console.log(chalk.blue.bold('\n🔄 Transform existing project\n'));

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!await fs.pathExists(packageJsonPath)) {
    console.log(chalk.red('\n❌ Not in a Node.js project directory'));
    console.log(chalk.gray('Run this command from your project root\n'));
    process.exit(1);
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const isTypeScript = await fs.pathExists(path.join(process.cwd(), 'tsconfig.json'));
  const ext = isTypeScript ? 'ts' : 'js';

  const response = await prompts([
    {
      type: 'multiselect',
      name: 'features',
      message: 'Select features to add:',
      choices: [
        { title: 'Environment Config (staging/production)', value: 'environments' },
        { title: 'Supabase Helper', value: 'supabase' },
        { title: 'Drizzle ORM Setup', value: 'drizzle' },
        { title: 'Supabase JWT Auth Middleware', value: 'supabaseAuth' },
        { title: 'Vercel Cron Setup', value: 'vercelCron' },
        { title: 'GitHub Workflow', value: 'github' },
        { title: 'RAG Service', value: 'rag' },
        { title: 'Chat Service', value: 'chat' },
        { title: 'Langfuse Integration', value: 'langfuse' },
        { title: 'Model Selection Middleware', value: 'modelSelection' },
        { title: 'Source Selection Middleware', value: 'sourceSelection' },
        { title: 'Error Handler Middleware', value: 'errorHandler' },
        { title: 'Winston Logger', value: 'logger' },
        { title: 'Response Formatter Helper', value: 'responseFormatter' },
      ]
    }
  ]);

  if (!response.features || response.features.length === 0) {
    console.log(chalk.yellow('\n⚠️ No features selected'));
    return;
  }

  const features = response.features as string[];
  
  // Additional prompts for RAG options
  let ragConfig: any = { embeddingProvider: 'openai', vectorStore: 'supabase', generateRoutes: true };
  if (features.includes('rag')) {
    const ragResponse = await prompts([
      {
        type: 'select',
        name: 'embeddingProvider',
        message: 'Choose embedding provider for RAG:',
        choices: [
          { title: 'OpenAI (text-embedding-3-small)', value: 'openai' },
          { title: 'Google Gemini (embedding-001)', value: 'gemini' },
          { title: 'Cohere (embed-english-v3.0)', value: 'cohere' }
        ],
        initial: 0
      },
      {
        type: 'select',
        name: 'vectorStore',
        message: 'Choose vector store for RAG:',
        choices: [
          { title: 'Supabase (pgvector)', value: 'supabase' },
          { title: 'Pinecone', value: 'pinecone' },
          { title: 'Chroma (local/self-hosted)', value: 'chroma' },
          { title: 'Weaviate', value: 'weaviate' }
        ],
        initial: 0
      },
      {
        type: 'confirm',
        name: 'generateRoutes',
        message: 'Generate RAG routes and controller?',
        initial: true
      }
    ]);
    ragConfig = { 
      embeddingProvider: ragResponse.embeddingProvider || 'openai', 
      vectorStore: ragResponse.vectorStore || 'supabase',
      generateRoutes: ragResponse.generateRoutes ?? true
    };
  }

  // Additional prompts for Chat options
  let chatConfig: any = { llmProvider: 'openai', chatDatabase: 'supabase', langfuse: false, generateRoutes: true };
  if (features.includes('chat')) {
    const chatResponse = await prompts([
      {
        type: 'select',
        name: 'llmProvider',
        message: 'Choose LLM provider for Chat:',
        choices: [
          { title: 'OpenAI (GPT-4o, GPT-4o-mini)', value: 'openai' },
          { title: 'Anthropic (Claude 3.5)', value: 'anthropic' },
          { title: 'Google Gemini (Gemini Pro)', value: 'gemini' }
        ],
        initial: 0
      },
      {
        type: 'select',
        name: 'chatDatabase',
        message: 'Choose database for chat history:',
        choices: [
          { title: 'Supabase (PostgreSQL)', value: 'supabase' },
          { title: 'PostgreSQL (direct)', value: 'pg' },
          { title: 'MySQL', value: 'mysql' }
        ],
        initial: 0
      },
      {
        type: 'confirm',
        name: 'langfuse',
        message: 'Include Langfuse for LLM observability?',
        initial: true
      },
      {
        type: 'confirm',
        name: 'generateRoutes',
        message: 'Generate Chat routes and controller?',
        initial: true
      }
    ]);
    chatConfig = { 
      llmProvider: chatResponse.llmProvider || 'openai', 
      chatDatabase: chatResponse.chatDatabase || 'supabase',
      langfuse: chatResponse.langfuse ?? false,
      generateRoutes: chatResponse.generateRoutes ?? true
    };
  }

  const spinner = ora('Transforming project...').start();

  try {
    const projectPath = process.cwd();
    const features = response.features as string[];

    // Ensure directories exist
    await fs.ensureDir(path.join(projectPath, 'src/middleware'));
    await fs.ensureDir(path.join(projectPath, 'src/helpers'));
    await fs.ensureDir(path.join(projectPath, 'src/utils'));
    await fs.ensureDir(path.join(projectPath, 'src/services'));
    await fs.ensureDir(path.join(projectPath, 'src/config'));

    const depsToAdd: Record<string, string> = {};
    const devDepsToAdd: Record<string, string> = {};

    // Generate selected features
    if (features.includes('environments')) {
      const { generateEnvironments } = await import('../generators/environments.js');
      await generateEnvironments(projectPath, { 
        name: packageJson.name,
        supabase: { usePooler: features.includes('drizzle') }
      } as any, ext);
      depsToAdd['dotenv'] = '^16.3.1';
    }

    if (features.includes('supabase')) {
      const { generateSupabaseHelper } = await import('../generators/supabase.js');
      await generateSupabaseHelper(projectPath, {
        name: packageJson.name,
        orm: features.includes('drizzle') ? 'drizzle' : 'raw',
        supabase: { usePooler: features.includes('drizzle') }
      } as any, ext);
      depsToAdd['@supabase/supabase-js'] = '^2.39.0';
    }

    if (features.includes('drizzle')) {
      depsToAdd['drizzle-orm'] = '^0.29.0';
      depsToAdd['postgres'] = '^3.4.0';
      devDepsToAdd['drizzle-kit'] = '^0.20.0';
    }

    if (features.includes('supabaseAuth')) {
      const { generateSupabaseJwtAuth } = await import('../generators/supabase.js');
      await generateSupabaseJwtAuth(projectPath, ext);
      depsToAdd['jose'] = '^5.2.0';
    }

    if (features.includes('vercelCron')) {
      const { generateVercelConfig, generateVercelCronRoutes, generateCronMiddleware, generateCronService } = await import('../generators/vercel.js');
      const framework = packageJson.dependencies?.hono ? 'hono' : 'express';
      await generateVercelConfig(projectPath, []);
      await generateVercelCronRoutes(projectPath, ext, framework);
      await generateCronMiddleware(projectPath, ext);
      await generateCronService(projectPath, ext);
    }

    if (features.includes('github')) {
      const { generateGithubWorkflow } = await import('../generators/github.js');
      await generateGithubWorkflow(projectPath, { deployTrigger: true });
    }

    if (features.includes('rag')) {
      const { generateRAGService, generateRAGSchema, generateRAGRoutes, generateRAGController } = await import('../generators/ai.js');
      const framework = packageJson.dependencies?.hono ? 'hono' : 'express';
      
      await generateRAGService(projectPath, {
        name: packageJson.name,
        ai: { 
          rag: true,
          embeddings: ragConfig.embeddingProvider,
          vectorStore: ragConfig.vectorStore
        }
      } as any, ext);
      
      // Generate schema
      await generateRAGSchema(projectPath, ragConfig.vectorStore, ext);
      
      // Generate routes and controller if requested
      if (ragConfig.generateRoutes) {
        await generateRAGRoutes(projectPath, framework, ext);
        await generateRAGController(projectPath, ext);
      }
      
      depsToAdd['@langchain/core'] = '^0.3.0';
      
      // Embedding provider dependencies
      if (ragConfig.embeddingProvider === 'openai') {
        depsToAdd['@langchain/openai'] = '^0.3.0';
      } else if (ragConfig.embeddingProvider === 'gemini') {
        depsToAdd['@langchain/google-genai'] = '^0.1.0';
      } else if (ragConfig.embeddingProvider === 'cohere') {
        depsToAdd['@langchain/cohere'] = '^0.3.0';
      }
      
      // Vector store dependencies
      if (ragConfig.vectorStore === 'supabase') {
        depsToAdd['@supabase/supabase-js'] = '^2.39.0';
      } else if (ragConfig.vectorStore === 'pinecone') {
        depsToAdd['@pinecone-database/pinecone'] = '^2.0.0';
        depsToAdd['@langchain/pinecone'] = '^0.1.0';
      } else if (ragConfig.vectorStore === 'chroma') {
        depsToAdd['chromadb'] = '^1.7.0';
        depsToAdd['@langchain/community'] = '^0.3.0';
      } else if (ragConfig.vectorStore === 'weaviate') {
        depsToAdd['weaviate-ts-client'] = '^2.0.0';
        depsToAdd['@langchain/weaviate'] = '^0.1.0';
      }
    }

    if (features.includes('chat')) {
      const { generateChatService, generateChatSchema, generateChatRoutes, generateChatController } = await import('../generators/ai.js');
      const framework = packageJson.dependencies?.hono ? 'hono' : 'express';
      
      await generateChatService(projectPath, {
        name: packageJson.name,
        ai: { 
          chat: true, 
          langfuse: chatConfig.langfuse,
          llmProvider: chatConfig.llmProvider,
          chatDatabase: chatConfig.chatDatabase
        }
      } as any, ext);
      
      // Generate schema
      await generateChatSchema(projectPath, chatConfig.chatDatabase, ext);
      
      // Generate routes and controller if requested
      if (chatConfig.generateRoutes) {
        await generateChatRoutes(projectPath, framework, ext);
        await generateChatController(projectPath, chatConfig.llmProvider, ext);
      }
      
      depsToAdd['@langchain/core'] = '^0.3.0';
      
      // LLM provider dependencies
      if (chatConfig.llmProvider === 'openai') {
        depsToAdd['@langchain/openai'] = '^0.3.0';
      } else if (chatConfig.llmProvider === 'anthropic') {
        depsToAdd['@langchain/anthropic'] = '^0.3.0';
      } else if (chatConfig.llmProvider === 'gemini') {
        depsToAdd['@langchain/google-genai'] = '^0.1.0';
      }
      
      // Database dependencies
      if (chatConfig.chatDatabase === 'supabase') {
        depsToAdd['@supabase/supabase-js'] = '^2.39.0';
      } else if (chatConfig.chatDatabase === 'pg') {
        depsToAdd['pg'] = '^8.11.0';
      } else if (chatConfig.chatDatabase === 'mysql') {
        depsToAdd['mysql2'] = '^3.6.0';
      }
      
      // Langfuse
      if (chatConfig.langfuse) {
        depsToAdd['langfuse-langchain'] = '^3.3.0';
        depsToAdd['langchain'] = '^0.3.0'; // Required peer dependency for langfuse-langchain
      }
    }

    if (features.includes('langfuse')) {
      depsToAdd['langfuse-langchain'] = '^3.3.0';
    }

    if (features.includes('modelSelection')) {
      const { generateModelConfig, generateSelectionMiddleware } = await import('../generators/ai.js');
      await generateModelConfig(projectPath, ext);
      // Only generate model selection middleware
      const modelSelectionContent = await fs.readFile(
        path.join(projectPath, `src/middleware/modelSelection.middleware.${ext}`), 
        'utf-8'
      ).catch(() => null);
      
      if (!modelSelectionContent) {
        await generateSelectionMiddleware(projectPath, ext);
      }
    }

    if (features.includes('sourceSelection')) {
      const { generateSourceConfig, generateSelectionMiddleware } = await import('../generators/ai.js');
      await generateSourceConfig(projectPath, ext);
      await generateSelectionMiddleware(projectPath, ext);
    }

    if (features.includes('errorHandler')) {
      await generateErrorHandler(projectPath, ext);
    }

    if (features.includes('logger')) {
      await generateLogger(projectPath, ext);
      depsToAdd['winston'] = '^3.11.0';
    }

    if (features.includes('responseFormatter')) {
      await generateResponseFormatter(projectPath, ext);
    }

    // Update package.json with new dependencies
    if (Object.keys(depsToAdd).length > 0 || Object.keys(devDepsToAdd).length > 0) {
      packageJson.dependencies = { ...packageJson.dependencies, ...depsToAdd };
      packageJson.devDependencies = { ...packageJson.devDependencies, ...devDepsToAdd };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    }

    spinner.succeed(chalk.green('Project transformed successfully!'));
    
    console.log(chalk.blue('\n📦 Next steps:'));
    console.log(chalk.gray('  npm install'));
    console.log(chalk.gray('  # Update your .env file with required variables'));
    console.log(chalk.gray('  # Import and use the new features in your app\n'));

    if (features.includes('vercelCron')) {
      console.log(chalk.yellow('📝 Vercel Cron Setup:'));
      console.log(chalk.gray('  1. Add cron jobs to vercel.json'));
      console.log(chalk.gray('  2. Set CRON_SECRET in Vercel environment'));
      console.log(chalk.gray('  3. Import cron routes in your app\n'));
    }

    if (features.includes('drizzle')) {
      console.log(chalk.yellow('📝 Drizzle Setup:'));
      console.log(chalk.gray('  1. Update drizzle.config.ts with your connection string'));
      console.log(chalk.gray('  2. Run: npx drizzle-kit generate'));
      console.log(chalk.gray('  3. Run: npx drizzle-kit push\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Failed to transform project'));
    console.error(error);
    process.exit(1);
  }
}

async function generateErrorHandler(projectPath: string, ext: string) {
  const content = `import logger from '../utils/logger.js';

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

const errorHandler = (err: ErrorWithStatus, req: any, res: any, next: any) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default errorHandler;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/errorHandler.${ext}`), content);
}

async function generateLogger(projectPath: string, ext: string) {
  const content = `import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
`;

  await fs.outputFile(path.join(projectPath, `src/utils/logger.${ext}`), content);
}

async function generateResponseFormatter(projectPath: string, ext: string) {
  const content = `import logger from '../utils/logger.js';

/**
 * Parses a raw string response into a JSON object
 */
export const formatJsonResponse = (rawResponse: any): any => {
  if (rawResponse === null || rawResponse === undefined) {
    return { error: 'Invalid input: null or undefined value provided.' };
  }

  if (typeof rawResponse === 'object') {
    if (rawResponse.error) return rawResponse;
    try {
      return JSON.parse(JSON.stringify(rawResponse));
    } catch (error: any) {
      return { error: 'Invalid input: object is not JSON-serializable.', details: error.message };
    }
  }

  if (typeof rawResponse !== 'string') {
    return { error: 'Invalid input type for JSON formatting.', inputType: typeof rawResponse };
  }

  if (rawResponse.trim() === '') {
    return { error: 'Invalid input: empty string provided.' };
  }

  let cleanedString = rawResponse;

  // Try parsing original string
  try {
    return JSON.parse(cleanedString);
  } catch (error) {
    // Continue with cleaning
  }

  // Remove markdown JSON fence
  const codeBlockMatch = cleanedString.trim().match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/i);
  if (codeBlockMatch) {
    cleanedString = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(cleanedString);
  } catch (error: any) {
    logger.error('Failed to parse JSON response', { error: error.message });
    return {
      error: 'Failed to format response as JSON.',
      details: error.message,
      originalLength: rawResponse.length
    };
  }
};

/**
 * Standard API response formatter
 */
export const apiResponse = {
  success: (data: any, message?: string) => ({
    success: true,
    message: message || 'Success',
    data
  }),
  
  error: (message: string, statusCode: number = 500, details?: any) => ({
    success: false,
    message,
    statusCode,
    ...(details && { details })
  }),
  
  paginated: (data: any[], page: number, limit: number, total: number) => ({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    }
  })
};
`;

  await fs.outputFile(path.join(projectPath, `src/helpers/responseFormatter.${ext}`), content);
}
