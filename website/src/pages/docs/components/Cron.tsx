import { CodeBlock } from '@/components/CodeBlock'

export function CronComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Cron</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Cron options for Node servers, Vercel, Postgres, and AWS SAM Lambda schedules.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add cron`} language="bash" />
        <CodeBlock
          code={`# Generate Lambda cron support in a SAM backend
nod init my-api --preset aws-sam-backend --cron true --yes

# Add Vercel cron endpoints/config
nod add vercel-cron`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Cron Types
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Node Cron</h4>
            <p className="text-sm text-muted-foreground mt-1">
              For long-running Node servers such as EC2 with PM2.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Vercel Cron</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Vercel scheduler calls protected HTTP endpoints.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Postgres Cron</h4>
            <p className="text-sm text-muted-foreground mt-1">
              pg_cron for database-native scheduled SQL.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Lambda Cron</h4>
            <p className="text-sm text-muted-foreground mt-1">
              AWS SAM Schedule events invoke generated Lambda handlers.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Lock Backends
        </h2>
        <p>Choose a lock backend to prevent duplicate job execution in cluster mode:</p>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">PostgreSQL</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Uses pg_advisory_lock for distributed locking
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">MySQL</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Uses GET_LOCK for distributed locking
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Redis</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Uses SETNX for high-performance locking
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Supabase</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Uses Supabase RPC for distributed locking
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">File-based</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Simple file locks for single-server deployments
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Cron Lock Utility</h3>
        <CodeBlock
          tsCode={`import { pool } from '../config/database.js';
import logger from './logger.js';

interface LockResult {
  acquired: boolean;
  release: () => Promise<void>;
}

export async function acquireLock(lockName: string): Promise<LockResult> {
  const lockId = hashLockName(lockName);

  try {
    // Try to acquire PostgreSQL advisory lock
    const result = await pool.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [lockId]
    );

    const acquired = result.rows[0]?.acquired === true;

    if (acquired) {
      logger.info(\`Lock acquired: \${lockName}\`);
    } else {
      logger.debug(\`Lock not acquired (already held): \${lockName}\`);
    }

    return {
      acquired,
      release: async () => {
        if (acquired) {
          await pool.query('SELECT pg_advisory_unlock($1)', [lockId]);
          logger.info(\`Lock released: \${lockName}\`);
        }
      }
    };
  } catch (error) {
    logger.error(\`Failed to acquire lock \${lockName}:\`, error);
    return { acquired: false, release: async () => {} };
  }
}

function hashLockName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}`}
          jsCode={`import { pool } from '../config/database.js';
import logger from './logger.js';

export async function acquireLock(lockName) {
  const lockId = hashLockName(lockName);

  try {
    // Try to acquire PostgreSQL advisory lock
    const result = await pool.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [lockId]
    );

    const acquired = result.rows[0]?.acquired === true;

    if (acquired) {
      logger.info(\`Lock acquired: \${lockName}\`);
    } else {
      logger.debug(\`Lock not acquired (already held): \${lockName}\`);
    }

    return {
      acquired,
      release: async () => {
        if (acquired) {
          await pool.query('SELECT pg_advisory_unlock($1)', [lockId]);
          logger.info(\`Lock released: \${lockName}\`);
        }
      }
    };
  } catch (error) {
    logger.error(\`Failed to acquire lock \${lockName}:\`, error);
    return { acquired: false, release: async () => {} };
  }
}

function hashLockName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}`}
        />

        <h3 className="font-semibold mt-6">Cron Job Example</h3>
        <CodeBlock
          tsCode={`import cron from 'node-cron';
import { acquireLock } from '../utils/cronLock.js';
import logger from '../utils/logger.js';

const JOB_NAME = 'daily-cleanup';

export function scheduleDailyCleanup() {
  // Run at midnight every day
  cron.schedule('0 0 * * *', async () => {
    const lock = await acquireLock(JOB_NAME);

    if (!lock.acquired) {
      logger.debug(\`\${JOB_NAME}: Another instance is running\`);
      return;
    }

    try {
      logger.info(\`\${JOB_NAME}: Starting...\`);

      // Your cleanup logic here
      await performCleanup();

      logger.info(\`\${JOB_NAME}: Completed\`);
    } catch (error) {
      logger.error(\`\${JOB_NAME}: Failed\`, error);
    } finally {
      await lock.release();
    }
  });

  logger.info(\`Scheduled: \${JOB_NAME}\`);
}

async function performCleanup() {
  // TODO: Implement cleanup
  // - Delete expired sessions
  // - Archive old records
  // - Clean temp files
}`}
          jsCode={`import cron from 'node-cron';
import { acquireLock } from '../utils/cronLock.js';
import logger from '../utils/logger.js';

const JOB_NAME = 'daily-cleanup';

export function scheduleDailyCleanup() {
  // Run at midnight every day
  cron.schedule('0 0 * * *', async () => {
    const lock = await acquireLock(JOB_NAME);

    if (!lock.acquired) {
      logger.debug(\`\${JOB_NAME}: Another instance is running\`);
      return;
    }

    try {
      logger.info(\`\${JOB_NAME}: Starting...\`);

      // Your cleanup logic here
      await performCleanup();

      logger.info(\`\${JOB_NAME}: Completed\`);
    } catch (error) {
      logger.error(\`\${JOB_NAME}: Failed\`, error);
    } finally {
      await lock.release();
    }
  });

  logger.info(\`Scheduled: \${JOB_NAME}\`);
}

async function performCleanup() {
  // TODO: Implement cleanup
  // - Delete expired sessions
  // - Archive old records
  // - Clean temp files
}`}
        />

        <h3 className="font-semibold mt-6">Vercel Cron</h3>
        <CodeBlock
          code={`{
  "crons": [
    {
      "path": "/cron/daily-task",
      "schedule": "0 3 * * *"
    }
  ]
}`}
          language="json"
        />

        <h3 className="font-semibold mt-6">Postgres Cron</h3>
        <CodeBlock
          code={`create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-cron-locks',
  '*/5 * * * *',
  $$delete from cron_locks where expires_at < now()$$
);`}
          language="sql"
        />

        <h3 className="font-semibold mt-6">AWS SAM Lambda Cron</h3>
        <CodeBlock
          code={`ScheduledCronFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: dist/
    Handler: cron-lambda.handler
    Events:
      DailyTaskSchedule:
        Type: Schedule
        Properties:
          Schedule: 'cron(0 3 * * ? *)'
          Input: '{"job":"daily-task"}'`}
          language="yaml"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <p>Initialize cron jobs in your app:</p>
        <CodeBlock
          tsCode={`// src/index.ts
import { scheduleDailyCleanup } from './cron/dailyCleanup.js';
import { scheduleHourlySync } from './cron/hourlySync.js';

// Start the server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);

  // Initialize cron jobs
  scheduleDailyCleanup();
  scheduleHourlySync();
});`}
          jsCode={`// src/index.js
import { scheduleDailyCleanup } from './cron/dailyCleanup.js';
import { scheduleHourlySync } from './cron/hourlySync.js';

// Start the server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);

  // Initialize cron jobs
  scheduleDailyCleanup();
  scheduleHourlySync();
});`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Why Distributed Locks?
        </h2>
        <p className="text-muted-foreground">
          When running in PM2 cluster mode, multiple worker processes run simultaneously.
          Without distributed locks, each worker would execute cron jobs independently,
          causing duplicate operations.
        </p>
        <p className="text-muted-foreground mt-2">
          Distributed locks ensure only one worker executes each cron job, even across
          multiple servers in a load-balanced setup.
        </p>
      </section>
    </div>
  )
}
