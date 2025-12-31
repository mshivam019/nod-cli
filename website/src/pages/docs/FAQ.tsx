export function FAQ() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">FAQ & Troubleshooting</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Common questions and solutions for nod-cli projects.
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            General
          </h2>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Which framework should I choose?</h3>
            <p>
              <strong>Express</strong> is the standard for Node.js APIs. Choose it if you need the vast ecosystem of Express middleware or are migrating an existing app.
            </p>
            <p>
              <strong>Hono</strong> is a modern, ultra-fast web standard framework. Choose it if you want better performance, TypeScript support, or plan to deploy to edge runtimes (Cloudflare Workers, Vercel Edge).
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Can I use Drizzle with MySQL?</h3>
            <p>
              Currently, the CLI optimizes Drizzle setup for PostgreSQL and Supabase. While Drizzle supports MySQL, our generators currently default to the PostgreSQL driver. You can manually configure Drizzle for MySQL by installing <code>mysql2</code> and updating <code>drizzle.config.ts</code>.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Database & ORM
          </h2>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I update my database schema?</h3>
            <p>If you are using Drizzle:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Modify <code>src/db/schema.ts</code></li>
              <li>Run <code>npm run db:generate</code> to create a migration</li>
              <li>Run <code>npm run db:push</code> to apply changes</li>
            </ol>
            <p className="mt-2">For raw SQL, you will need to manage migrations manually or use a separate tool.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">I added RAG/Chat but don't see tables?</h3>
            <p>
              If you are using Drizzle, the CLI automatically updates <code>src/db/schema.ts</code>. Run <code>npm run db:push</code> to create them.
            </p>
            <p>
              If not using Drizzle, check the <code>sql/</code> folder for SQL scripts to run in your database dashboard.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
            Deployment
          </h2>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I deploy?</h3>
            <p>The CLI generates deployment configurations for you:</p>
            <ul className="list-disc list-inside ml-2">
              <li><strong>Docker:</strong> Use the generated <code>Dockerfile</code></li>
              <li><strong>Vercel:</strong> Use the generated <code>vercel.json</code></li>
              <li><strong>PM2:</strong> Use <code>ecosystem.config.js</code> for VPS deployment</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
