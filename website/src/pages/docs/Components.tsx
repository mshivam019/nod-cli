import { CodeBlock } from '@/components/CodeBlock'

export function Components() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Components</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add individual components to your project with the <code className="bg-muted px-1.5 py-0.5 rounded text-sm">nod add</code> command.
        </p>
      </div>

      <div className="space-y-8">
        {/* Frameworks Section */}
        <section id="frameworks">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Frameworks
          </h2>
          <p className="mt-4">
            nod-cli supports two web frameworks out of the box:
          </p>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Express</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The most popular Node.js web framework. Battle-tested and widely adopted with extensive middleware ecosystem.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Hono</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ultrafast web framework with built-in TypeScript support. Works on Edge, Node.js, Deno, and Bun.
              </p>
            </div>
          </div>
          <CodeBlock
            code={`# Choose framework during init
nod init my-api --framework express
nod init my-api --framework hono`}
            language="bash"
          />
        </section>

        {/* Database Section */}
        <section id="database">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Database Integration
          </h2>
          <p className="mt-4">
            Connect to your preferred database with built-in drivers and ORM support.
          </p>

          <h3 className="font-semibold mt-6">Supabase</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Full Supabase client with storage helpers and optional JWT authentication.
          </p>
          <CodeBlock
            code={`# Add Supabase helper
nod add supabase

# Includes:
# - Supabase client configuration
# - Optional JWT auth middleware (using jose library)
# - Storage helpers`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Drizzle ORM</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Type-safe ORM with connection pooler support for Supabase.
          </p>
          <CodeBlock
            code={`# Add Drizzle ORM
nod add drizzle

# Commands after install:
npx drizzle-kit generate
npx drizzle-kit push
npx drizzle-kit studio`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Database Options</h3>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">PostgreSQL</h4>
              <p className="text-sm text-muted-foreground">Direct connection with pg driver</p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">MySQL</h4>
              <p className="text-sm text-muted-foreground">MySQL/MariaDB with mysql2 driver</p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">Supabase</h4>
              <p className="text-sm text-muted-foreground">Managed PostgreSQL with extras</p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium">None</h4>
              <p className="text-sm text-muted-foreground">No database configuration</p>
            </div>
          </div>
        </section>

        {/* Authentication Section */}
        <section id="authentication">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Authentication
          </h2>
          <p className="mt-4">
            Secure your API with built-in authentication middleware.
          </p>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">JWT</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Standard JSON Web Token authentication with configurable secret.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">JWKS</h3>
              <p className="text-sm text-muted-foreground mt-1">
                JSON Web Key Set for rotating keys and enterprise SSO.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Supabase Auth</h3>
              <p className="text-sm text-muted-foreground mt-1">
                JWKS-based JWT verification using the jose library.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">None</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No authentication (for public APIs or custom auth).
              </p>
            </div>
          </div>

          <CodeBlock
            code={`# Add Supabase with auth
nod add supabase
# Select "Yes" when asked about JWT auth middleware`}
            language="bash"
          />
        </section>

        {/* AI Features Section */}
        <section id="ai">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            AI Features
          </h2>
          <p className="mt-4">
            Add AI capabilities to your API with LangChain-powered services.
          </p>

          <h3 className="font-semibold mt-6">RAG Service</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Vector similarity search with multiple embedding providers and vector stores.
          </p>
          <CodeBlock
            code={`# Add RAG service
nod add rag

# Choose embedding provider:
# - OpenAI (text-embedding-3-small)
# - Google Gemini (embedding-001)
# - Cohere (embed-english-v3.0)

# Choose vector store:
# - Supabase (pgvector)
# - Pinecone
# - Chroma (local/self-hosted)
# - Weaviate`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Chat Service</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conversation management with LLM providers and chat history storage.
          </p>
          <CodeBlock
            code={`# Add Chat service
nod add chat

# Choose LLM provider:
# - OpenAI (GPT-4o, GPT-4o-mini)
# - Anthropic (Claude 3.5)
# - Google Gemini (Gemini Pro)

# Choose database for history:
# - Supabase (PostgreSQL)
# - PostgreSQL (direct)
# - MySQL`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Langfuse</h3>
          <p className="text-sm text-muted-foreground mt-1">
            LLM observability and tracing for monitoring your AI features.
          </p>
          <CodeBlock
            code={`# Add Langfuse integration
nod add langfuse

# Set environment variables:
# LANGFUSE_PUBLIC_KEY=your_public_key
# LANGFUSE_SECRET_KEY=your_secret_key`}
            language="bash"
          />
        </section>

        {/* Deployment Section */}
        <section id="deployment">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Deployment
          </h2>
          <p className="mt-4">
            Production-ready deployment configurations.
          </p>

          <h3 className="font-semibold mt-6">PM2</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Process manager with cluster mode and thread-safe cron jobs.
          </p>
          <CodeBlock
            code={`# Add PM2 configuration
nod add pm2

# Run with PM2
pm2 start ecosystem.config.js`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Vercel Cron</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Serverless cron jobs with Vercel&apos;s built-in scheduler.
          </p>
          <CodeBlock
            code={`# Add Vercel cron configuration
nod add vercel-cron

# Creates:
# - vercel.json with cron config
# - Cron routes and middleware
# - CRON_SECRET authentication`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">GitHub Actions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            CI/CD workflow for automated Vercel deployments.
          </p>
          <CodeBlock
            code={`# Add GitHub Actions workflow
nod add github-actions

# Trigger deployment with --deploy in commit message
git commit -m "feat: new feature --deploy"`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Cron Jobs</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Distributed cron with locking support for PM2 cluster mode.
          </p>
          <CodeBlock
            code={`# Add cron support
nod add cron

# Lock backends:
# - PostgreSQL
# - MySQL
# - Redis
# - Supabase
# - File-based`}
            language="bash"
          />
        </section>

        {/* Routes & Middleware Section */}
        <section id="routes">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Routes & Middleware
          </h2>
          <p className="mt-4">
            Generate boilerplate code for routes, controllers, services, and middleware.
          </p>

          <h3 className="font-semibold mt-6">Add Route</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Creates a complete route with controller and service.
          </p>
          <CodeBlock
            code={`# Add a new route
nod add route users

# Creates:
# - src/routes/users.routes.ts
# - src/controllers/users.controller.ts
# - src/services/users.service.ts`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Add Middleware</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Creates a middleware file with standard structure.
          </p>
          <CodeBlock
            code={`# Add middleware
nod add middleware rateLimit

# Creates:
# - src/middleware/rateLimit.middleware.ts`}
            language="bash"
          />

          <h3 className="font-semibold mt-6">Add Service</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Creates a standalone service for business logic.
          </p>
          <CodeBlock
            code={`# Add service
nod add service email

# Creates:
# - src/services/email.service.ts`}
            language="bash"
          />
        </section>

        {/* Presets Section */}
        <section id="presets">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Presets
          </h2>
          <p className="mt-4">
            Use built-in or custom presets to quickly scaffold projects with predefined configurations.
          </p>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Preset</th>
                  <th className="text-left py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1.5 py-0.5 rounded text-sm">minimal</code></td>
                  <td className="py-2 text-muted-foreground">Basic setup, no database or auth</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1.5 py-0.5 rounded text-sm">api</code></td>
                  <td className="py-2 text-muted-foreground">Standard REST API with JWT auth</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1.5 py-0.5 rounded text-sm">full</code></td>
                  <td className="py-2 text-muted-foreground">All features including Supabase, Drizzle, Vercel cron</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1.5 py-0.5 rounded text-sm">ai</code></td>
                  <td className="py-2 text-muted-foreground">Full preset + RAG, Chat, Langfuse</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code className="bg-muted px-1.5 py-0.5 rounded text-sm">1</code></td>
                  <td className="py-2 text-muted-foreground">Supabase + Drizzle + Langfuse + API Audit + GitHub Actions</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CodeBlock
            code={`# Create custom preset
nod preset create mystack

# Use preset
nod init my-api --preset mystack --yes`}
            language="bash"
          />
        </section>
      </div>
    </div>
  )
}
