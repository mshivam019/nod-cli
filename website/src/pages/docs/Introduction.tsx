import { Link } from 'react-router-dom'
import { CodeBlock } from '@/components/CodeBlock'

export function Introduction() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">nod-cli</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Backend scaffolding CLI for Node.js with best practices built-in.
        </p>
      </div>

      <div className="space-y-4">
        <p>
          Generate production-ready Express or Hono projects with TypeScript, authentication,
          database connections, AI features, and more.
        </p>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Features
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/docs/components/route" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">Multiple Frameworks</h3>
            <p className="text-sm text-muted-foreground">
              Support for Express and Hono with TypeScript or JavaScript
            </p>
          </Link>
          <Link to="/docs/components/supabase" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">Database Integration</h3>
            <p className="text-sm text-muted-foreground">
              PostgreSQL, MySQL, Supabase with Drizzle ORM
            </p>
          </Link>
          <Link to="/docs/components/supabase" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">Authentication</h3>
            <p className="text-sm text-muted-foreground">
              JWT, JWKS, and Supabase Auth out of the box
            </p>
          </Link>
          <Link to="/docs/components/rag" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">AI Features</h3>
            <p className="text-sm text-muted-foreground">
              RAG, Chat services, and Langfuse observability
            </p>
          </Link>
          <Link to="/docs/components/pm2" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">Deployment Ready</h3>
            <p className="text-sm text-muted-foreground">
              Docker, PM2, Vercel cron, and GitHub Actions
            </p>
          </Link>
          <Link to="/docs/presets" className="feature-card rounded-lg border p-4 block">
            <h3 className="font-semibold">Presets</h3>
            <p className="text-sm text-muted-foreground">
              Built-in and custom presets for quick project setup
            </p>
          </Link>
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Quick Start
        </h2>

        <CodeBlock
          code={`# Install globally
npm install -g nod-cli

# Create a new project
nod init my-api

# Or use shorthand
nod my-api`}
          language="bash"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Project Structure
        </h2>

        <p>Generated projects follow a clean, organized structure:</p>

        <CodeBlock
          code={`my-api/
├── src/
│   ├── routes/          # Route definitions
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Custom middleware
│   ├── config/          # App configuration
│   ├── helpers/         # Utilities
│   ├── utils/           # Logger, etc.
│   ├── db/              # Database connection & schema
│   └── types/           # TypeScript types
├── docs/                # Project documentation
├── .env.example
├── package.json
└── tsconfig.json`}
          language="plaintext"
        />
      </div>
    </div>
  )
}
