import { CodeBlock } from "@/components/CodeBlock";

export function CLI() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">
          CLI Reference
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Complete reference for all nod-cli commands and options.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          init
        </h2>

        <p>Initialize a new project with the specified configuration.</p>

        <CodeBlock
          code={`nod init <project-name> [options]

# Shorthand (same as init)
nod <project-name> [options]`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Options
        </h3>

        <CodeBlock
          code={`--framework <framework>  Web framework: express or hono (default: express)
--ts                     Use TypeScript (default: true)
--no-ts                  Use JavaScript instead
--db <database>          Database: pg, mysql, supabase, or none
--auth <auth>            Auth: jwt, jwks, supabase, cookie-session, better-auth, or none
--queue <queue>          Queue: bull or none
--preset <preset>        Use a preset: production-api, aws-sam-backend, minimal, api, full, ai, 1, or custom
--security <mode>        Security: basic or strict
--deploy-target <target> Deploy target: node or lambda-sam
-y, --yes                Skip prompts, use defaults`}
          language="plaintext"
        />

        <p>
          Every successful <code>nod init</code> run writes a project-specific{" "}
          <code>AGENTS.md</code> file in the project root so AI contributors
          know the expected file layout and coding conventions.
        </p>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          backend
        </h2>

        <p>Create a production AWS SAM backend without prompts.</p>

        <CodeBlock
          code={`nod backend my-api

# Equivalent explicit init form
nod init my-api --preset aws-sam-backend --deploy-target lambda-sam --auth better-auth --yes`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          add
        </h2>

        <p>Add components to an existing project.</p>

        <CodeBlock
          code={`nod add <component> [options]

# Examples
nod add route users
nod add middleware rateLimit
nod add service email
nod add rag
nod add chat`}
          language="bash"
        />

        <CodeBlock
          code={`add options (for non-interactive use):
-n, --name <name>
-y, --yes
--lock-backend <backend>
--embedding-provider <provider>
--vector-store <store>
--llm-provider <provider>
--chat-database <database>
--langfuse <boolean>
--generate-routes <boolean>
--supabase-auth <boolean>
--auth-mode <mode>
--supabase-admin <boolean>
--custom-jwt <boolean>
--jwks <boolean>
--forgot-password <boolean>
--google-oauth <boolean>
--email-service <boolean>`}
          language="plaintext"
        />

        <CodeBlock
          code={`route-specific options:
--method <method>             get|post|put|delete|patch
--path <path>                 route path
--create-controller <boolean> true|false
--create-service <boolean>    true|false
--middleware <list>           authMiddleware,loggingMiddleware,roleMiddleware`}
          language="plaintext"
        />

        <CodeBlock
          code={`middleware/service options:
--type <type>                 logger|rateLimit|cors|custom
--default <boolean>           true|false
--with-database <boolean>     true|false
--methods <list>              getAll,getById,create,update,delete`}
          language="plaintext"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Available Components
        </h3>

        <div className="grid gap-2 md:grid-cols-2">
          {[
            { name: "route", desc: "Route with controller and service" },
            { name: "middleware", desc: "Custom middleware" },
            { name: "service", desc: "Business logic service" },
            { name: "controller", desc: "Request handler" },
            { name: "cron", desc: "Cron job support" },
            { name: "pm2", desc: "PM2 configuration" },
            { name: "rag", desc: "RAG service" },
            { name: "chat", desc: "Chat service" },
            { name: "vercel-cron", desc: "Vercel cron setup" },
            { name: "github-actions", desc: "GitHub workflow" },
            { name: "supabase", desc: "Supabase helper" },
            { name: "drizzle", desc: "Drizzle ORM setup" },
            { name: "langfuse", desc: "LLM observability" },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <code className="text-sm font-mono">{item.name}</code>
              <span className="text-sm text-muted-foreground">
                - {item.desc}
              </span>
            </div>
          ))}
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          transform
        </h2>

        <p>Add nod features to an existing project.</p>

        <CodeBlock
          code={`# Interactive mode
nod transform

# Non-interactive mode (AI/CI friendly)
nod transform --features environments,drizzle,github,migrateRoutes --yes

# Enable all transform features without prompts
nod transform --all --yes`}
          language="bash"
        />

        <CodeBlock
          code={`Transform options:
--features <list>             Comma-separated features
--all                         Enable all transform features
-y, --yes                     Non-interactive mode
--rag-embedding <provider>    openai|gemini|cohere
--rag-vector-store <store>    supabase|pinecone|chroma|weaviate
--rag-generate-routes <bool>  true|false
--chat-llm-provider <model>   openai|anthropic|gemini
--chat-database <db>          supabase|pg|mysql
--chat-langfuse <bool>        true|false
--chat-generate-routes <bool> true|false`}
          language="plaintext"
        />

        <p>
          Every successful <code>transform</code> run also updates{" "}
          <code>AGENTS.md</code> based on selected features.
        </p>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          preset
        </h2>

        <p>Manage custom presets.</p>

        <CodeBlock
          code={`nod preset list              # List all presets
nod preset create [name]     # Create a new preset
nod preset delete [name]     # Delete a custom preset
nod preset default [name]    # Set default preset
nod preset show <name>       # Show preset details`}
          language="bash"
        />

        <CodeBlock
          code={`# Non-interactive preset creation
nod preset create sam-api --db supabase --orm drizzle --auth better-auth --security strict --deploy-target lambda-sam --yes

# Non-interactive delete/default
nod preset delete sam-api --yes
nod preset default aws-sam-backend
nod preset default --clear --yes`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          mcp
        </h2>

        <p>Run the built-in local MCP server over stdio.</p>

        <CodeBlock
          code={`nod mcp

# Optional: set custom server name
nod mcp --name nod-cli`}
          language="bash"
        />

        <p>
          See the dedicated MCP docs at <code>/docs/mcp</code> for host
          configuration and tool usage.
        </p>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          validate
        </h2>

        <p>Validate project structure and dependencies.</p>

        <CodeBlock code="nod validate" language="bash" />
      </div>
    </div>
  );
}
