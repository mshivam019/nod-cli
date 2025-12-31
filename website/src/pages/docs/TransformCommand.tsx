import { CodeBlock } from '@/components/CodeBlock'

export function TransformCommand() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Transform Command</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add nod-cli features to existing projects.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>

        <p>
          The transform command adds nod-cli features to an existing project. It presents an
          interactive menu to select which features to add.
        </p>

        <CodeBlock
          code={`# Navigate to your existing project
cd my-existing-project

# Run transform
nod transform`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Available Features
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Environment Config</h3>
            <p className="text-sm text-muted-foreground">
              Staging and production environment configurations
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Supabase Helper</h3>
            <p className="text-sm text-muted-foreground">
              Supabase client with storage helpers
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Drizzle ORM Setup</h3>
            <p className="text-sm text-muted-foreground">
              Type-safe ORM configuration
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Supabase JWT Auth</h3>
            <p className="text-sm text-muted-foreground">
              JWKS-based JWT verification middleware
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Vercel Cron Setup</h3>
            <p className="text-sm text-muted-foreground">
              Cron job configuration for Vercel
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">GitHub Workflow</h3>
            <p className="text-sm text-muted-foreground">
              CI/CD workflow for deployments
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">RAG Service</h3>
            <p className="text-sm text-muted-foreground">
              Vector similarity search with embeddings
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Chat Service</h3>
            <p className="text-sm text-muted-foreground">
              Conversation management with LangChain
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Langfuse Integration</h3>
            <p className="text-sm text-muted-foreground">
              LLM observability and tracing
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Model/Source Selection</h3>
            <p className="text-sm text-muted-foreground">
              Domain-based routing middleware
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Error Handler</h3>
            <p className="text-sm text-muted-foreground">
              Centralized error handling middleware
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Winston Logger</h3>
            <p className="text-sm text-muted-foreground">
              Production-ready logging setup
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Response Formatter</h3>
            <p className="text-sm text-muted-foreground">
              Consistent API response formatting
            </p>
          </div>
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Example Output
        </h2>

        <CodeBlock
          code={`$ nod transform

? Select features to add: (Press <space> to select)
❯ ◯ Environment Config (staging/production)
  ◯ Supabase Helper
  ◯ Drizzle ORM Setup
  ◯ Supabase JWT Auth Middleware
  ◯ Vercel Cron Setup
  ◯ GitHub Workflow
  ◯ RAG Service
  ◯ Chat Service
  ◯ Langfuse Integration
  ◯ Model/Source Selection Middleware
  ◯ Error Handler
  ◯ Winston Logger
  ◯ Response Formatter`}
          language="plaintext"
        />
      </div>
    </div>
  )
}
