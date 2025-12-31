import { CodeBlock } from '@/components/CodeBlock'

export function Configuration() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Configuration</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Configuration options and environment setup.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Project Configuration
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-4 text-left font-semibold">Option</th>
                <th className="py-2 px-4 text-left font-semibold">Choices</th>
                <th className="py-2 px-4 text-left font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4">Framework</td>
                <td className="py-2 px-4">Express, Hono</td>
                <td className="py-2 px-4">Web framework</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">TypeScript</td>
                <td className="py-2 px-4">Yes, No</td>
                <td className="py-2 px-4">Type safety</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">Database</td>
                <td className="py-2 px-4">PostgreSQL, MySQL, Supabase, None</td>
                <td className="py-2 px-4">Database driver</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">ORM</td>
                <td className="py-2 px-4">Drizzle, Raw SQL, None</td>
                <td className="py-2 px-4">ORM choice</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4">Auth</td>
                <td className="py-2 px-4">JWT, JWKS, Supabase, None</td>
                <td className="py-2 px-4">Authentication</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Environment Variables
        </h2>

        <p>Generated projects include a <code>.env.example</code> file:</p>

        <CodeBlock
          code={`# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Supabase (if using Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# JWT (if using JWT auth)
JWT_SECRET=your-secret-key

# AI (if using AI features)
OPENAI_API_KEY=sk-xxx

# Langfuse (if using Langfuse)
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_HOST=https://cloud.langfuse.com

# Vercel Cron (if using Vercel cron)
CRON_SECRET=your-cron-secret`}
          language="bash"
          filename=".env.example"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          TypeScript Configuration
        </h2>

        <p>Generated TypeScript projects include a configured <code>tsconfig.json</code>:</p>

        <CodeBlock
          code={`{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`}
          language="json"
          filename="tsconfig.json"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          PM2 Configuration
        </h2>

        <p>When PM2 is enabled, an <code>ecosystem.config.js</code> is generated:</p>

        <CodeBlock
          code={`module.exports = {
  apps: [{
    name: 'my-api',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
  }],
};`}
          language="javascript"
          filename="ecosystem.config.js"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Drizzle Configuration
        </h2>

        <p>When Drizzle is enabled:</p>

        <CodeBlock
          code={`import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});`}
          language="typescript"
          filename="drizzle.config.ts"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Vercel Configuration
        </h2>

        <p>When Vercel cron is enabled:</p>

        <CodeBlock
          code={`{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 0 * * *"
    }
  ]
}`}
          language="json"
          filename="vercel.json"
        />
      </div>
    </div>
  )
}
