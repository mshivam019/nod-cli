import { Link } from 'react-router-dom'

const components = [
  {
    name: 'Route',
    href: '/docs/components/route',
    description: 'Generate routes with controllers and services',
    category: 'Core'
  },
  {
    name: 'Middleware',
    href: '/docs/components/middleware',
    description: 'Create custom middleware (logger, rate limit, CORS)',
    category: 'Core'
  },
  {
    name: 'Service',
    href: '/docs/components/service',
    description: 'Generate business logic services with CRUD operations',
    category: 'Core'
  },
  {
    name: 'Supabase',
    href: '/docs/components/supabase',
    description: 'Supabase client with storage helpers and JWT auth',
    category: 'Database'
  },
  {
    name: 'Drizzle',
    href: '/docs/components/drizzle',
    description: 'Type-safe ORM with connection pooler support',
    category: 'Database'
  },
  {
    name: 'RAG',
    href: '/docs/components/rag',
    description: 'Vector search with multiple embedding providers',
    category: 'AI'
  },
  {
    name: 'Chat',
    href: '/docs/components/chat',
    description: 'Conversation management with LLM providers',
    category: 'AI'
  },
  {
    name: 'Langfuse',
    href: '/docs/components/langfuse',
    description: 'LLM observability and tracing',
    category: 'AI'
  },
  {
    name: 'PM2',
    href: '/docs/components/pm2',
    description: 'Process manager with cluster mode',
    category: 'Deployment'
  },
  {
    name: 'Vercel Cron',
    href: '/docs/components/vercel-cron',
    description: 'Serverless cron jobs configuration',
    category: 'Deployment'
  },
  {
    name: 'GitHub Actions',
    href: '/docs/components/github-actions',
    description: 'CI/CD workflow for deployments',
    category: 'Deployment'
  },
  {
    name: 'Cron',
    href: '/docs/components/cron',
    description: 'Distributed cron with locking support',
    category: 'Deployment'
  }
]

const categories = ['Core', 'Database', 'AI', 'Deployment']

export function Components() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Components</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add individual components to your project with the{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">nod add</code> command.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-4">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            {category}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {components
              .filter((c) => c.category === category)
              .map((component) => (
                <Link
                  key={component.name}
                  to={component.href}
                  className="feature-card rounded-lg border p-4 block"
                >
                  <h3 className="font-semibold">{component.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {component.description}
                  </p>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
