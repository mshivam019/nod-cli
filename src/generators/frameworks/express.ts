import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig, TemplateContext } from '../../types/index.js';

export async function generateExpressProject(
  projectPath: string,
  config: ProjectConfig,
  ctx: TemplateContext
) {
  await generateAppFile(projectPath, config, ctx);
  await generateServerFile(projectPath, config, ctx);
  await generateMiddleware(projectPath, config, ctx);
  
  if (config.database !== 'none') {
    await generateDatabaseConnection(projectPath, config, ctx);
  }
  
  if (config.features.cron) {
    await generateCronSetup(projectPath, ctx, config);
  }

  await generateExampleRoute(projectPath, ctx);
}

async function generateAppFile(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';
  
  const appContent = isTS
    ? `import express, { Express, Request, Response, NextFunction } from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', router);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  ${ctx.hasCron ? 'initCronJobs();' : ''}

  return app;
}
`
    : `import express from 'express';
import { router } from './routes/index.js';
${ctx.hasCron ? "import { initCronJobs } from './cron/index.js';" : ''}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', router);

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  ${ctx.hasCron ? 'initCronJobs();' : ''}

  return app;
}
`;

  await fs.outputFile(path.join(projectPath, `src/app.${ext}`), appContent);
}

async function generateServerFile(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const needsDbConnect = ctx.hasDatabase && !ctx.hasDrizzle;
  
  const serverContent = `import { createApp } from './app.js';
import { config } from './config/index.js';
${needsDbConnect ? "import { connectDatabase } from './db/index.js';" : ''}

async function startServer() {
  ${needsDbConnect ? 'await connectDatabase();' : ''}
  
  const app = createApp();
  
  app.listen(config.port, () => {
    console.log(\`🚀 Server running on port \${config.port}\`);
  });
}

startServer().catch(console.error);
`;

  await fs.outputFile(path.join(projectPath, `src/server.${ext}`), serverContent);
}

async function generateMiddleware(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';
  
  // Note: Using 'middleware' (singular) folder, not 'middlewares'
  
  if (ctx.hasAuth && !ctx.hasSupabaseAuth) {
    // Only generate basic JWT auth if not using Supabase auth
    const authMiddleware = isTS
      ? `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  user?: any;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function roleMiddleware(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
`
      : `import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/auth.${ext}`), authMiddleware);
  }

  // Error handler middleware
  const errorHandlerContent = isTS
    ? `import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

const errorHandler = (err: ErrorWithStatus, _req: Request, res: Response, _next: NextFunction) => {
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
`
    : `import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
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

  await fs.outputFile(path.join(projectPath, `src/middleware/errorHandler.${ext}`), errorHandlerContent);
}

async function generateDatabaseConnection(projectPath: string, config: ProjectConfig, ctx: TemplateContext) {
  if (config.database === 'none') return;

  const ext = ctx.fileExt;
  let dbContent = '';

  if (config.database === 'pg') {
    dbContent = `import { Pool } from 'pg';
import { config } from '../config/index.js';

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  min: config.database.pool.min,
  max: config.database.pool.max,
});

export async function connectDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
`;
  } else if (config.database === 'mysql') {
    dbContent = `import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  connectionLimit: config.database.pool.max,
});

export async function connectDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}
`;
  }

  await fs.outputFile(path.join(projectPath, `src/db/index.${ext}`), dbContent);
}

async function generateCronSetup(projectPath: string, ctx: TemplateContext, config: ProjectConfig) {
  const { generateThreadSafeCron } = await import('../pm2.js');
  
  // Determine lock backend based on database
  let lockBackend: 'redis' | 'postgres' | 'mysql' | 'file' = 'file';
  if (config.database === 'pg') {
    lockBackend = 'postgres';
  } else if (config.database === 'mysql') {
    lockBackend = 'mysql';
  }
  
  await generateThreadSafeCron(projectPath, ctx.fileExt, lockBackend);
}

async function generateExampleRoute(projectPath: string, ctx: TemplateContext) {
  const ext = ctx.fileExt;
  const isTS = ext === 'ts';
  
  // Simple route file - no complex declarative system
  // Only import auditLogger if both supabase auth AND apiAudit are enabled
  const useAuditLogger = ctx.hasSupabaseAuth && ctx.hasApiAudit;
  
  const routeContent = ctx.hasSupabaseAuth 
    ? `import { Router } from 'express';
import jwtAuth from '../middleware/jwtAuth.middleware.js';
${useAuditLogger ? "import { auditLogger } from '../middleware/auditLog.middleware.js';" : ''}
import { exampleController } from '../controllers/example.js';

export const router = Router();

// Protected routes (require auth${useAuditLogger ? ' + audit' : ''})
router.get('/example', jwtAuth, ${useAuditLogger ? 'auditLogger, ' : ''}exampleController.getExample);

// Add more routes here:
// router.post('/example', jwtAuth, ${useAuditLogger ? 'auditLogger, ' : ''}exampleController.createExample);
// router.put('/example/:id', jwtAuth, ${useAuditLogger ? 'auditLogger, ' : ''}exampleController.updateExample);
// router.delete('/example/:id', jwtAuth, ${useAuditLogger ? 'auditLogger, ' : ''}exampleController.deleteExample);
`
    : `import { Router } from 'express';
import { exampleController } from '../controllers/example.js';

export const router = Router();

// Routes
router.get('/example', exampleController.getExample);

// Add more routes here:
// router.post('/example', exampleController.createExample);
// router.put('/example/:id', exampleController.updateExample);
// router.delete('/example/:id', exampleController.deleteExample);
`;

  await fs.outputFile(path.join(projectPath, `src/routes/index.${ext}`), routeContent);

  // Simple controller
  const controllerContent = isTS
    ? `import { Request, Response } from 'express';
import { exampleService } from '../services/example.js';

export const exampleController = {
  async getExample(_req: Request, res: Response) {
    try {
      const data = await exampleService.getData();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
`
    : `import { exampleService } from '../services/example.js';

export const exampleController = {
  async getExample(req, res) {
    try {
      const data = await exampleService.getData();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
`;

  await fs.outputFile(path.join(projectPath, `src/controllers/example.${ext}`), controllerContent);

  // Simple service
  const serviceContent = `export const exampleService = {
  async getData() {
    // TODO: Implement your business logic here
    return { message: 'Hello from nod-cli!' };
  },
};
`;

  await fs.outputFile(path.join(projectPath, `src/services/example.${ext}`), serviceContent);
}
