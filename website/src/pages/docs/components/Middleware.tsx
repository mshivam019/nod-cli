import { CodeBlock } from '@/components/CodeBlock'

export function MiddlewareComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Middleware</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Create custom middleware with pre-built templates for common use cases.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock
          code={`nod add middleware <name>`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Options
        </h2>
        <p>The command will prompt you for:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Middleware Type</strong> - Request Logger, Shared-store Rate Limiter, CORS, or Custom</li>
          <li><strong>Rate Limiter Store</strong> - Postgres table by default, or Redis when explicitly selected</li>
          <li><strong>Apply as Default</strong> - Automatically add to app.ts</li>
        </ul>
        <CodeBlock
          code={`# Preferred: Drizzle/Postgres-backed limiter
nod add middleware --name rateLimit --type rateLimit --rate-limit-store postgres --yes

# Alternative: Redis/ElastiCache-backed limiter
nod add middleware --name rateLimit --type rateLimit --rate-limit-store redis --yes`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Logger Middleware (Express)</h3>
        <CodeBlock
          tsCode={`import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${req.method}] \${req.path} - \${res.statusCode} (\${duration}ms)\`);
  });

  next();
}`}
          jsCode={`import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${req.method}] \${req.path} - \${res.statusCode} (\${duration}ms)\`);
  });

  next();
}`}
        />

        <h3 className="font-semibold mt-6">Shared Rate Limiter Middleware (Express)</h3>
        <p className="text-muted-foreground">
          Rate limiting is generated as a shared-store service and middleware pair.
          Use Postgres/Drizzle first when your app already has a database. Use Redis
          only when the project already operates Redis or needs very high-throughput limits.
        </p>
        <CodeBlock
          tsCode={`import type { NextFunction, Request, Response } from 'express';
import rateLimitService from '../services/rateLimit.service.js';

type RateLimitConfig = {
  scope: string;
  limit: number;
  windowSeconds: number;
  keyParts: (req: Request) => Array<string | number | null | undefined>;
};

export const createRateLimitMiddleware = (limitConfig: RateLimitConfig) => (
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await rateLimitService.hit({
      scope: limitConfig.scope,
      limit: limitConfig.limit,
      windowSeconds: limitConfig.windowSeconds,
      parts: limitConfig.keyParts(req),
    });

    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remainingPoints));
    res.setHeader('RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({ success: false, message: 'Too many requests' });
    }

    return next();
  }
);`}
          jsCode={`import rateLimitService from '../services/rateLimit.service.js';

export const createRateLimitMiddleware = limitConfig => (
  async (req, res, next) => {
    const result = await rateLimitService.hit({
      scope: limitConfig.scope,
      limit: limitConfig.limit,
      windowSeconds: limitConfig.windowSeconds,
      parts: limitConfig.keyParts(req),
    });

    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remainingPoints));
    res.setHeader('RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({ success: false, message: 'Too many requests' });
    }

    return next();
  }
);`}
        />

        <h3 className="font-semibold mt-6">CORS Middleware (Express)</h3>
        <CodeBlock
          tsCode={`import { Request, Response, NextFunction } from 'express';

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}`}
          jsCode={`export function corsMiddleware(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}`}
        />

        <h3 className="font-semibold mt-6">Logger Middleware (Hono)</h3>
        <CodeBlock
          tsCode={`import { Context, Next } from 'hono';

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(\`[\${c.req.method}] \${c.req.path} - \${c.res.status} (\${duration}ms)\`);
}`}
          jsCode={`import { Context, Next } from 'hono';

export async function loggerMiddleware(c, next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(\`[\${c.req.method}] \${c.req.path} - \${c.res.status} (\${duration}ms)\`);
}`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          tsCode={`// Declarative route pattern - Register middleware in router config
import { createConfiguredRouter, METHODS } from '../config/router.js';

import { rateLimiters } from './middleware/rateLimit.middleware.js';

// Register the generated limiter
router.registerMiddleware('rateLimit', rateLimiters.apiMutation);

// Use in route definitions
const routes = [
  {
    method: METHODS.POST,
    path: '/api/login',
    handler: authController.login,
    enabled: ['rateLimit']  // Add rate limiting to this route
  },
];

// Or apply globally in Express
import { rateLimiters } from './middleware/rateLimit.middleware.js';
app.use('/api', rateLimiters.apiRead);

// Hono global middleware
import { loggerMiddleware } from './middleware/logger.js';
app.use('*', loggerMiddleware);`}
          jsCode={`// Declarative route pattern - Register middleware in router config
import { createConfiguredRouter, METHODS } from '../config/router.js';

import { rateLimiters } from './middleware/rateLimit.middleware.js';

// Register the generated limiter
router.registerMiddleware('rateLimit', rateLimiters.apiMutation);

// Use in route definitions
const routes = [
  {
    method: METHODS.POST,
    path: '/api/login',
    handler: authController.login,
    enabled: ['rateLimit']  // Add rate limiting to this route
  },
];

// Or apply globally in Express
import { rateLimiters } from './middleware/rateLimit.middleware.js';
app.use('/api', rateLimiters.apiRead);

// Hono global middleware
import { loggerMiddleware } from './middleware/logger.js';
app.use('*', loggerMiddleware);`}
        />
      </section>
    </div>
  )
}
