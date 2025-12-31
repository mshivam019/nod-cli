import { CodeBlock } from '@/components/CodeBlock'

export function AddCommand() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Add Command</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add components, services, and features to existing projects.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Basic Usage
        </h2>

        <CodeBlock
          code={`# Navigate to your project
cd my-api

# Add a component
nod add <component> [options]`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Routes
        </h2>

        <p>Add a new route with controller and service:</p>

        <CodeBlock
          code={`nod add route users

# Creates:
# - src/routes/users.ts
# - src/controllers/usersController.ts
# - src/services/usersService.ts`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Middleware
        </h2>

        <p>Add custom middleware:</p>

        <CodeBlock
          code={`nod add middleware rateLimit

# Creates:
# - src/middleware/rateLimit.ts`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Services
        </h2>

        <p>Add standalone services:</p>

        <CodeBlock
          code={`nod add service email

# Creates:
# - src/services/emailService.ts`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          AI Features
        </h2>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">RAG Service</h3>

        <CodeBlock
          code={`nod add rag

# Supports:
# - OpenAI, Gemini, Cohere embeddings
# - Supabase, Pinecone, Chroma, Weaviate vector stores`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Chat Service</h3>

        <CodeBlock
          code={`nod add chat

# Supports:
# - OpenAI, Anthropic, Gemini
# - Conversation persistence`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Langfuse</h3>

        <CodeBlock
          code={`nod add langfuse

# Adds LLM observability and tracing`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Database & ORM
        </h2>

        <CodeBlock
          code={`# Add Supabase client
nod add supabase

# Add Drizzle ORM
nod add drizzle`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Deployment
        </h2>

        <CodeBlock
          code={`# Add Vercel cron configuration
nod add vercel-cron

# Add GitHub Actions workflow
nod add github-actions

# Add PM2 configuration
nod add pm2

# Add cron job support
nod add cron`}
          language="bash"
        />
      </div>
    </div>
  )
}
