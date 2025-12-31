import { CodeBlock } from '@/components/CodeBlock'

export function Presets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Presets</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Pre-configured project templates for common use cases.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Built-in Presets
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-4 text-left font-semibold">Preset</th>
                <th className="py-2 px-4 text-left font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4"><code>minimal</code></td>
                <td className="py-2 px-4">Basic setup, no database or auth</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>api</code></td>
                <td className="py-2 px-4">Standard REST API with JWT auth and PostgreSQL</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>full</code></td>
                <td className="py-2 px-4">All features: Supabase, Drizzle, Vercel cron</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>ai</code></td>
                <td className="py-2 px-4">Full preset + RAG, Chat, Langfuse</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>1</code></td>
                <td className="py-2 px-4">Supabase + Drizzle + Langfuse + API Audit + GitHub Actions</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Usage</h3>

        <CodeBlock
          code={`# Use a preset with --yes to skip prompts
nod init my-api --preset api --yes

# Use the "1" preset
nod my-api --preset 1 --yes

# AI-focused project
nod init my-api --preset ai --yes`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Custom Presets
        </h2>

        <p>Create and manage your own presets for repeated use.</p>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Create a Preset</h3>

        <CodeBlock
          code={`# Interactive preset creation
nod preset create mystack`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">List Presets</h3>

        <CodeBlock code="nod preset list" language="bash" />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Set Default Preset</h3>

        <CodeBlock
          code={`# Set a default preset
nod preset default mystack

# Now 'nod init my-api --yes' uses mystack`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Show Preset Details</h3>

        <CodeBlock code="nod preset show mystack" language="bash" />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Delete a Preset</h3>

        <CodeBlock code="nod preset delete mystack" language="bash" />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Preset Storage
        </h2>

        <p>
          Custom presets are stored in <code>~/.nod-cli/presets.json</code> and can be shared
          across projects.
        </p>

        <CodeBlock
          code={`{
  "presets": {
    "mystack": {
      "framework": "express",
      "typescript": true,
      "database": "supabase",
      "orm": "drizzle",
      "auth": "supabase",
      "features": ["langfuse", "audit", "github"]
    }
  },
  "default": "mystack"
}`}
          language="json"
        />
      </div>
    </div>
  )
}
