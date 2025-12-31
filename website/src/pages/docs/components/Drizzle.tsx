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
          code={`import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const env = process.env.NODE_ENV || 'staging';
const connectionString = env === 'production' 
  ? process.env.SUPABASE_POOLER_URL
  : process.env.SUPABASE_STAGING_POOLER_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
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

const client = postgres(connectionString!, { 
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export default db;`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Schema (src/db/schema.ts)</h3>
        <CodeBlock
          code={`import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// API Audit table - logs all API requests
export const apiAudit = pgTable('my_api_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  eventType: text('event_type').notNull(),
  eventData: text('event_data'),
  llmResponse: jsonb('llm_response'),
  createdAt: timestamp('created_at').defaultNow(),
});

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
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# Open Drizzle Studio (GUI)
npx drizzle-kit studio`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          code={`import { db } from './db/index.js';
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
          language="typescript"
        />
      </section>
    </div>
  )
}
