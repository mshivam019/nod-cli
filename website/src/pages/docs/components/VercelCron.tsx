import { CodeBlock } from '@/components/CodeBlock'

export function VercelCronComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Vercel Cron</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Serverless cron jobs with Vercel's built-in scheduler.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add vercel-cron`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Vercel Config (vercel.json)</h3>
        <CodeBlock
          code={`{
  "crons": [
    {
      "path": "/api/cron/daily-cleanup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/hourly-sync",
      "schedule": "0 * * * *"
    }
  ]
}`}
          language="json"
        />

        <h3 className="font-semibold mt-6">Cron Middleware (src/middleware/cron.middleware.ts)</h3>
        <CodeBlock
          code={`import { Request, Response, NextFunction } from 'express';

const CRON_SECRET = process.env.CRON_SECRET;

export function cronAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (authHeader !== \`Bearer \${CRON_SECRET}\`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Cron Routes (src/routes/cron.routes.ts)</h3>
        <CodeBlock
          code={`import { Router } from 'express';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import { cronAuth } from '../middleware/cron.middleware.js';
import { cronController } from '../controllers/cron.controller.js';

const router = Router();

/**
 * Default middlewares - all cron routes require authentication
 */
const defaultMiddlewares: string[] = ['cronAuth'];
const defaultRoles: string[] = [];

const routes = [
  {
    method: METHODS.GET,
    path: '/daily-cleanup',
    handler: cronController.dailyCleanup
  },
  {
    method: METHODS.GET,
    path: '/hourly-sync',
    handler: cronController.hourlySync
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.registerMiddleware('cronAuth', cronAuth);
dr.applyToExpress(router);

export default router;`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Cron Service (src/services/cron.service.ts)</h3>
        <CodeBlock
          code={`import logger from '../utils/logger.js';

export const cronService = {
  async dailyCleanup() {
    logger.info('Running daily cleanup...');
    
    // TODO: Implement cleanup logic
    // - Delete old sessions
    // - Archive old data
    // - Clean temp files
    
    return { cleaned: 0 };
  },

  async hourlySync() {
    logger.info('Running hourly sync...');
    
    // TODO: Implement sync logic
    // - Sync with external APIs
    // - Update caches
    // - Process queued jobs
    
    return { synced: 0 };
  }
};`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`# Set in Vercel dashboard
CRON_SECRET=your-secure-random-string`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Cron Schedule Syntax
        </h2>
        <CodeBlock
          code={`# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of week (0 - 6)
# │ │ │ │ │
# * * * * *

"0 0 * * *"     # Daily at midnight
"0 * * * *"     # Every hour
"*/15 * * * *"  # Every 15 minutes
"0 9 * * 1"     # Every Monday at 9 AM
"0 0 1 * *"     # First day of every month`}
          language="plaintext"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <p>Import the cron routes in your app:</p>
        <CodeBlock
          code={`import cronRoutes from './routes/cron.routes.js';

app.use('/api/cron', cronRoutes);`}
          language="typescript"
        />
      </section>
    </div>
  )
}
