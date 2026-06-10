import { CodeBlock } from '@/components/CodeBlock'

export function DrizzleComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Drizzle</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Type-safe ORM with connection pooler support for Supabase.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add drizzle`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Drizzle Config (drizzle.config.ts)</h3>
        <CodeBlock
          code={`/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const env = process.env.NODE_ENV || 'staging';
const connectionString = env === 'production' 
  ? process.env.SUPABASE_POOLER_URL
  : process.env.SUPABASE_STAGING_POOLER_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  tablesFilter: ['your_project_*'],
  strict: true,
  dbCredentials: {
    url: connectionString!,
  },
});`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Database Connection (src/db/index.ts)</h3>
        <CodeBlock
          code={`import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/config.js';
import * as schema from './schema.js';

const connectionString = config.supabasePoolerUrl;

if (!connectionString) {
  throw new Error('Supabase pooler URL is not configured.');
}

const client = postgres(connectionString, {
  prepare: false,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
export default db;`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Schema (src/db/schema.ts)</h3>
        <CodeBlock
          code={`import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// API Audit table - logs all API requests
export const apiAudit = pgTable('my_api_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  eventType: text('event_type').notNull(),
  eventData: text('event_data'),
  llmResponse: jsonb('llm_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, table => [
  index('idx_my_api_audit_user_id').on(table.userId),
  index('idx_my_api_audit_event_type').on(table.eventType),
  index('idx_my_api_audit_created_at').on(table.createdAt),
]);

// Add your own tables here
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`# Production
SUPABASE_POOLER_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres

# Staging
SUPABASE_STAGING_POOLER_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Commands
        </h2>
        <CodeBlock
          code={`# Generate migrations from schema changes
pnpm exec drizzle-kit generate --config=drizzle.config.ts

# Apply migrations
pnpm exec drizzle-kit migrate --config=drizzle.config.ts

# Open Drizzle Studio (GUI)
pnpm exec drizzle-kit studio`}
          language="bash"
        />
        <p className="text-sm text-muted-foreground">
          Keep the generated <code>drizzle/</code> folder in git. These migration files are the deployment history and should be versioned.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          tsCode={`import { db } from './db/index.js';
import { users, apiAudit } from './db/schema.js';
import { eq } from 'drizzle-orm';

// Select all users
const allUsers = await db.select().from(users);

// Select by ID
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
const newUser = await db.insert(users).values({
  email: 'user@example.com',
  name: 'John Doe'
}).returning();

// Update
await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, userId));

// Delete
await db.delete(users).where(eq(users.id, userId));`}
          jsCode={`import { db } from './db/index.js';
import { users, apiAudit } from './db/schema.js';
import { eq } from 'drizzle-orm';

// Select all users
const allUsers = await db.select().from(users);

// Select by ID
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
const newUser = await db.insert(users).values({
  email: 'user@example.com',
  name: 'John Doe'
}).returning();

// Update
await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, userId));

// Delete
await db.delete(users).where(eq(users.id, userId));`}
        />
      </section>
    </div>
  )
}
