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
          <li><strong>Middleware Type</strong> - Request Logger, Rate Limiter, CORS, or Custom</li>
          <li><strong>Apply as Default</strong> - Automatically add to app.ts</li>
        </ul>
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

        <h3 className="font-semibold mt-6">Rate Limiter Middleware (Express)</h3>
        <CodeBlock
          tsCode={`import { Request, Response, NextFunction } from 'express';

const requests = new Map<string, number[]>();

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const userRequests = requests.get(ip)!.filter(time => now - time < windowMs);

  if (userRequests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  userRequests.push(now);
  requests.set(ip, userRequests);
  next();
}`}
          jsCode={`const requests = new Map();

export function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const userRequests = requests.get(ip).filter(time => now - time < windowMs);

  if (userRequests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  userRequests.push(now);
  requests.set(ip, userRequests);
  next();
}`}
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

// Register the middleware
router.registerMiddleware('rateLimit', rateLimitMiddleware);

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
import { loggerMiddleware } from './middleware/logger.js';
app.use(loggerMiddleware);

// Hono global middleware
import { loggerMiddleware } from './middleware/logger.js';
app.use('*', loggerMiddleware);`}
          jsCode={`// Declarative route pattern - Register middleware in router config
import { createConfiguredRouter, METHODS } from '../config/router.js';

// Register the middleware
router.registerMiddleware('rateLimit', rateLimitMiddleware);

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
import { loggerMiddleware } from './middleware/logger.js';
app.use(loggerMiddleware);

// Hono global middleware
import { loggerMiddleware } from './middleware/logger.js';
app.use('*', loggerMiddleware);`}
        />
      </section>
    </div>
  )
}
