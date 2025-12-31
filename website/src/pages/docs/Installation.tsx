import { CodeBlock } from '@/components/CodeBlock'

export function Installation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Installation</h1>
        <p className="text-lg text-muted-foreground mt-2">
          How to install nod-cli and create your first project.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Global Installation
        </h2>

        <p>Install nod-cli globally using npm:</p>

        <CodeBlock code="npm install -g nod-cli" language="bash" />

        <p>Or use npx to run without installing:</p>

        <CodeBlock code="npx nod-cli init my-api" language="bash" />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Create a New Project
        </h2>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Interactive Mode
        </h3>

        <p>Run the init command and follow the prompts:</p>

        <CodeBlock
          code={`nod init my-api

# Or use shorthand
nod my-api`}
          language="bash"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Non-Interactive Mode
        </h3>

        <p>Use flags to skip prompts (great for CI/CD):</p>

        <CodeBlock
          code={`# TypeScript with preset 1
nod init my-api --preset 1 --yes

# JavaScript project with API preset
nod init my-api --preset api --no-ts --yes

# Hono framework with Supabase
nod init my-api --framework hono --db supabase --auth supabase --yes`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          CLI Options
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-4 text-left font-semibold">Option</th>
                <th className="py-2 px-4 text-left font-semibold">Description</th>
                <th className="py-2 px-4 text-left font-semibold">Default</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4"><code>--framework</code></td>
                <td className="py-2 px-4">express or hono</td>
                <td className="py-2 px-4">express</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>--ts / --no-ts</code></td>
                <td className="py-2 px-4">Use TypeScript or JavaScript</td>
                <td className="py-2 px-4">true</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>--db</code></td>
                <td className="py-2 px-4">pg, mysql, supabase, or none</td>
                <td className="py-2 px-4">pg</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>--auth</code></td>
                <td className="py-2 px-4">jwt, jwks, supabase, or none</td>
                <td className="py-2 px-4">jwt</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>--preset</code></td>
                <td className="py-2 px-4">Use a preset configuration</td>
                <td className="py-2 px-4">-</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>-y, --yes</code></td>
                <td className="py-2 px-4">Skip prompts, use defaults</td>
                <td className="py-2 px-4">false</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Running Your Project
        </h2>

        <CodeBlock
          code={`cd my-api
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev`}
          language="bash"
        />
      </div>
    </div>
  )
}
