import { CodeBlock } from '@/components/CodeBlock'

export function CLI() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">CLI Reference</h1>
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

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Options</h3>

        <CodeBlock
          code={`--framework <framework>  Web framework: express or hono (default: express)
--ts                     Use TypeScript (default: true)
--no-ts                  Use JavaScript instead
--db <database>          Database: pg, mysql, supabase, or none (default: pg)
--auth <auth>            Auth: jwt, jwks, supabase, or none (default: jwt)
--queue <queue>          Queue: bull or none (default: none)
--preset <preset>        Use a preset: minimal, api, full, ai, 1, or custom
-y, --yes                Skip prompts, use defaults`}
          language="plaintext"
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

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Available Components
        </h3>

        <div className="grid gap-2 md:grid-cols-2">
          {[
            { name: 'route', desc: 'Route with controller and service' },
            { name: 'middleware', desc: 'Custom middleware' },
            { name: 'service', desc: 'Business logic service' },
            { name: 'controller', desc: 'Request handler' },
            { name: 'cron', desc: 'Cron job support' },
            { name: 'pm2', desc: 'PM2 configuration' },
            { name: 'rag', desc: 'RAG service' },
            { name: 'chat', desc: 'Chat service' },
            { name: 'vercel-cron', desc: 'Vercel cron setup' },
            { name: 'github-actions', desc: 'GitHub workflow' },
            { name: 'supabase', desc: 'Supabase helper' },
            { name: 'drizzle', desc: 'Drizzle ORM setup' },
            { name: 'langfuse', desc: 'LLM observability' },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-2 rounded-md border p-2">
              <code className="text-sm font-mono">{item.name}</code>
              <span className="text-sm text-muted-foreground">- {item.desc}</span>
            </div>
          ))}
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          transform
        </h2>

        <p>Add nod features to an existing project.</p>

        <CodeBlock code="nod transform" language="bash" />

        <p>
          This command presents an interactive menu to select which features to add to your
          existing project.
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

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          validate
        </h2>

        <p>Validate project structure and dependencies.</p>

        <CodeBlock code="nod validate" language="bash" />
      </div>
    </div>
  )
}
