import fs from 'fs-extra';
import * as path from 'path';
import { RateLimitStore } from '../types/index.js';

export async function generateSharedRateLimit(
  projectPath: string,
  ext: string,
  tableName = 'rate_limits',
  store: Exclude<RateLimitStore, 'none'> = 'postgres'
) {
  if (store === 'postgres') {
    await updateDrizzleSchema(projectPath, ext, tableName);
  }

  await fs.outputFile(path.join(projectPath, `src/services/rateLimit.service.${ext}`), generateRateLimitService(ext, store));
  await fs.outputFile(path.join(projectPath, `src/middleware/rateLimit.middleware.${ext}`), generateRateLimitMiddleware(ext));
}

async function updateDrizzleSchema(projectPath: string, ext: string, tableName: string) {
  const schemaPath = path.join(projectPath, `src/db/schema.${ext}`);
  if (!await fs.pathExists(schemaPath)) {
    return;
  }

  let schema = await fs.readFile(schemaPath, 'utf-8');
  if (schema.includes('export const rateLimits =')) {
    return;
  }

  schema = schema.replace(
    /import \{ ([^}]+) \} from 'drizzle-orm\/pg-core';/,
    (_match, imports: string) => {
      const names = new Set(imports.split(',').map((name: string) => name.trim()).filter(Boolean));
      names.add('integer');
      return `import { ${Array.from(names).sort().join(', ')} } from 'drizzle-orm/pg-core';`;
    },
  );

  const table = `
export const rateLimits = pgTable('${tableName}', {
  key: text('key').primaryKey(),
  points: integer('points').notNull(),
  expire: timestamp('expire', { withTimezone: true }),
}, table => [
  index('idx_${tableName}_expire').on(table.expire),
]);
`;

  await fs.writeFile(schemaPath, `${schema.trimEnd()}\n${table}`);
}

function generateRateLimitService(ext: string, store: Exclude<RateLimitStore, 'none'>): string {
  return store === 'redis'
    ? generateRedisRateLimitService(ext)
    : generatePostgresRateLimitService(ext);
}

function generatePostgresRateLimitService(ext: string): string {
  const isTS = ext === 'ts';

  return isTS
    ? `import crypto from 'crypto';
import { lt } from 'drizzle-orm';
import { RateLimiterDrizzle, RateLimiterRes } from 'rate-limiter-flexible';
import db from '../db/index.js';
import { rateLimits } from '../db/schema.js';

type RateLimitHitInput = {
  scope: string;
  parts: Array<string | number | null | undefined>;
  limit: number;
  windowSeconds: number;
};

export type RateLimitHitResult = {
  allowed: boolean;
  consumedPoints: number;
  remainingPoints: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: Date;
};

type LimiterKey = string;

const limiters = new Map<LimiterKey, RateLimiterDrizzle>();

const keySecret = () => (
  process.env.RATE_LIMIT_KEY_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  'development-rate-limit-key-secret-change-me'
);

const limiterKey = (input: Pick<RateLimitHitInput, 'scope' | 'limit' | 'windowSeconds'>): LimiterKey =>
  \`\${input.scope}:\${input.limit}:\${input.windowSeconds}\`;

const getLimiter = (input: Pick<RateLimitHitInput, 'scope' | 'limit' | 'windowSeconds'>): RateLimiterDrizzle => {
  const key = limiterKey(input);
  const existing = limiters.get(key);
  if (existing) return existing;

  const limiter = new RateLimiterDrizzle({
    storeClient: db,
    schema: rateLimits,
    keyPrefix: input.scope,
    points: input.limit,
    duration: input.windowSeconds,
    clearExpiredByTimeout: false,
  });
  limiters.set(key, limiter);
  return limiter;
};

const hashIdentifier = (scope: string, parts: Array<string | number | null | undefined>): string => {
  const source = [scope, ...parts.map(part => String(part ?? 'unknown'))].join('|');
  return crypto.createHmac('sha256', keySecret()).update(source).digest('hex');
};

const toHitResult = (limiterResult: RateLimiterRes, limit: number, allowed: boolean): RateLimitHitResult => {
  const retryAfterSeconds = Math.max(1, Math.ceil(limiterResult.msBeforeNext / 1000));

  return {
    allowed,
    consumedPoints: limiterResult.consumedPoints,
    remainingPoints: limiterResult.remainingPoints,
    limit,
    retryAfterSeconds,
    resetAt: new Date(Date.now() + Math.max(limiterResult.msBeforeNext, 0)),
  };
};

export const rateLimitService = {
  async hit(input: RateLimitHitInput): Promise<RateLimitHitResult> {
    const limiter = getLimiter(input);
    const key = hashIdentifier(input.scope, input.parts);

    try {
      const result = await limiter.consume(key, 1);
      return toHitResult(result, input.limit, true);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return toHitResult(error, input.limit, false);
      }
      throw error;
    }
  },

  async cleanupExpiredOlderThan(cutoff: Date): Promise<number> {
    const deleted = await db
      .delete(rateLimits)
      .where(lt(rateLimits.expire, cutoff))
      .returning({ key: rateLimits.key });

    return deleted.length;
  },
};

export default rateLimitService;
`
    : `import crypto from 'crypto';
import { lt } from 'drizzle-orm';
import { RateLimiterDrizzle, RateLimiterRes } from 'rate-limiter-flexible';
import db from '../db/index.js';
import { rateLimits } from '../db/schema.js';

const limiters = new Map();

const keySecret = () => (
  process.env.RATE_LIMIT_KEY_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  'development-rate-limit-key-secret-change-me'
);

const limiterKey = input => \`\${input.scope}:\${input.limit}:\${input.windowSeconds}\`;

const getLimiter = input => {
  const key = limiterKey(input);
  const existing = limiters.get(key);
  if (existing) return existing;

  const limiter = new RateLimiterDrizzle({
    storeClient: db,
    schema: rateLimits,
    keyPrefix: input.scope,
    points: input.limit,
    duration: input.windowSeconds,
    clearExpiredByTimeout: false,
  });
  limiters.set(key, limiter);
  return limiter;
};

const hashIdentifier = (scope, parts) => {
  const source = [scope, ...parts.map(part => String(part ?? 'unknown'))].join('|');
  return crypto.createHmac('sha256', keySecret()).update(source).digest('hex');
};

const toHitResult = (limiterResult, limit, allowed) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(limiterResult.msBeforeNext / 1000));
  return {
    allowed,
    consumedPoints: limiterResult.consumedPoints,
    remainingPoints: limiterResult.remainingPoints,
    limit,
    retryAfterSeconds,
    resetAt: new Date(Date.now() + Math.max(limiterResult.msBeforeNext, 0)),
  };
};

export const rateLimitService = {
  async hit(input) {
    const limiter = getLimiter(input);
    const key = hashIdentifier(input.scope, input.parts);

    try {
      const result = await limiter.consume(key, 1);
      return toHitResult(result, input.limit, true);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return toHitResult(error, input.limit, false);
      }
      throw error;
    }
  },

  async cleanupExpiredOlderThan(cutoff) {
    const deleted = await db
      .delete(rateLimits)
      .where(lt(rateLimits.expire, cutoff))
      .returning({ key: rateLimits.key });

    return deleted.length;
  },
};

export default rateLimitService;
`;
}

function generateRedisRateLimitService(ext: string): string {
  const isTS = ext === 'ts';

  return isTS
    ? `import crypto from 'crypto';
import { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

type RateLimitHitInput = {
  scope: string;
  parts: Array<string | number | null | undefined>;
  limit: number;
  windowSeconds: number;
};

export type RateLimitHitResult = {
  allowed: boolean;
  consumedPoints: number;
  remainingPoints: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: Date;
};

type LimiterKey = string;

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
    });

const limiters = new Map<LimiterKey, RateLimiterRedis>();

const keySecret = () => (
  process.env.RATE_LIMIT_KEY_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  'development-rate-limit-key-secret-change-me'
);

const limiterKey = (input: Pick<RateLimitHitInput, 'scope' | 'limit' | 'windowSeconds'>): LimiterKey =>
  \`\${input.scope}:\${input.limit}:\${input.windowSeconds}\`;

const getLimiter = (input: Pick<RateLimitHitInput, 'scope' | 'limit' | 'windowSeconds'>): RateLimiterRedis => {
  const key = limiterKey(input);
  const existing = limiters.get(key);
  if (existing) return existing;

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: input.scope,
    points: input.limit,
    duration: input.windowSeconds,
  });
  limiters.set(key, limiter);
  return limiter;
};

const hashIdentifier = (scope: string, parts: Array<string | number | null | undefined>): string => {
  const source = [scope, ...parts.map(part => String(part ?? 'unknown'))].join('|');
  return crypto.createHmac('sha256', keySecret()).update(source).digest('hex');
};

const toHitResult = (limiterResult: RateLimiterRes, limit: number, allowed: boolean): RateLimitHitResult => {
  const retryAfterSeconds = Math.max(1, Math.ceil(limiterResult.msBeforeNext / 1000));

  return {
    allowed,
    consumedPoints: limiterResult.consumedPoints,
    remainingPoints: limiterResult.remainingPoints,
    limit,
    retryAfterSeconds,
    resetAt: new Date(Date.now() + Math.max(limiterResult.msBeforeNext, 0)),
  };
};

export const rateLimitService = {
  async hit(input: RateLimitHitInput): Promise<RateLimitHitResult> {
    const limiter = getLimiter(input);
    const key = hashIdentifier(input.scope, input.parts);

    try {
      const result = await limiter.consume(key, 1);
      return toHitResult(result, input.limit, true);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return toHitResult(error, input.limit, false);
      }
      throw error;
    }
  },

  async cleanupExpiredOlderThan(_cutoff: Date): Promise<number> {
    return 0;
  },

  async close(): Promise<void> {
    await redis.quit();
  },
};

export default rateLimitService;
`
    : `import crypto from 'crypto';
import { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
    });

const limiters = new Map();

const keySecret = () => (
  process.env.RATE_LIMIT_KEY_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  'development-rate-limit-key-secret-change-me'
);

const limiterKey = input => \`\${input.scope}:\${input.limit}:\${input.windowSeconds}\`;

const getLimiter = input => {
  const key = limiterKey(input);
  const existing = limiters.get(key);
  if (existing) return existing;

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: input.scope,
    points: input.limit,
    duration: input.windowSeconds,
  });
  limiters.set(key, limiter);
  return limiter;
};

const hashIdentifier = (scope, parts) => {
  const source = [scope, ...parts.map(part => String(part ?? 'unknown'))].join('|');
  return crypto.createHmac('sha256', keySecret()).update(source).digest('hex');
};

const toHitResult = (limiterResult, limit, allowed) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(limiterResult.msBeforeNext / 1000));
  return {
    allowed,
    consumedPoints: limiterResult.consumedPoints,
    remainingPoints: limiterResult.remainingPoints,
    limit,
    retryAfterSeconds,
    resetAt: new Date(Date.now() + Math.max(limiterResult.msBeforeNext, 0)),
  };
};

export const rateLimitService = {
  async hit(input) {
    const limiter = getLimiter(input);
    const key = hashIdentifier(input.scope, input.parts);

    try {
      const result = await limiter.consume(key, 1);
      return toHitResult(result, input.limit, true);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return toHitResult(error, input.limit, false);
      }
      throw error;
    }
  },

  async cleanupExpiredOlderThan(_cutoff) {
    return 0;
  },

  async close() {
    await redis.quit();
  },
};

export default rateLimitService;
`;
}

function generateRateLimitMiddleware(ext: string): string {
  const isTS = ext === 'ts';

  return isTS
    ? `import type { NextFunction, Request, Response } from 'express';
import rateLimitService from '../services/rateLimit.service.js';

type RateLimitConfig = {
  scope: string;
  limit: number;
  windowSeconds: number;
  keyParts: (req: Request) => Array<string | number | null | undefined>;
};

const getClientIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';
const userId = (req: Request): string | undefined => (req as any).user?.id;

export const createRateLimitMiddleware = (limitConfig: RateLimitConfig) => (
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

export const rateLimiters = {
  login: createRateLimitMiddleware({
    scope: 'login',
    limit: 20,
    windowSeconds: 5 * 60,
    keyParts: req => [getClientIp(req), typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : undefined],
  }),
  apiRead: createRateLimitMiddleware({
    scope: 'api-read',
    limit: 300,
    windowSeconds: 60,
    keyParts: req => [userId(req), getClientIp(req)],
  }),
  apiMutation: createRateLimitMiddleware({
    scope: 'api-mutation',
    limit: 60,
    windowSeconds: 60,
    keyParts: req => [userId(req), getClientIp(req)],
  }),
};

export default rateLimiters;
`
    : `import rateLimitService from '../services/rateLimit.service.js';

const getClientIp = req => req.ip || req.socket.remoteAddress || 'unknown';
const userId = req => req.user?.id;

export const createRateLimitMiddleware = limitConfig => (
  async (req, res, next) => {
    try {
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
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

export const rateLimiters = {
  login: createRateLimitMiddleware({
    scope: 'login',
    limit: 20,
    windowSeconds: 5 * 60,
    keyParts: req => [getClientIp(req), typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : undefined],
  }),
  apiRead: createRateLimitMiddleware({
    scope: 'api-read',
    limit: 300,
    windowSeconds: 60,
    keyParts: req => [userId(req), getClientIp(req)],
  }),
  apiMutation: createRateLimitMiddleware({
    scope: 'api-mutation',
    limit: 60,
    windowSeconds: 60,
    keyParts: req => [userId(req), getClientIp(req)],
  }),
};

export default rateLimiters;
`;
}
