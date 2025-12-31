import { CodeBlock } from '@/components/CodeBlock'

export function PM2Component() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">PM2</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Process manager with cluster mode for production deployments.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add pm2`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">PM2 Config (ecosystem.config.js)</h3>
        <CodeBlock
          code={`module.exports = {
  apps: [
    {
      name: 'my-api',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      // Watch (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
  ],
};`}
          language="javascript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Commands
        </h2>
        <CodeBlock
          code={`# Start application
pm2 start ecosystem.config.js

# Start with specific environment
pm2 start ecosystem.config.js --env staging

# View running processes
pm2 list

# View logs
pm2 logs my-api

# Monitor resources
pm2 monit

# Restart application
pm2 restart my-api

# Stop application
pm2 stop my-api

# Delete from PM2
pm2 delete my-api

# Save process list (for auto-restart on reboot)
pm2 save

# Setup startup script
pm2 startup`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          NPM Scripts
        </h2>
        <p>The following scripts are added to your package.json:</p>
        <CodeBlock
          code={`{
  "scripts": {
    "start:pm2": "pm2 start ecosystem.config.js",
    "stop:pm2": "pm2 stop ecosystem.config.js",
    "restart:pm2": "pm2 restart ecosystem.config.js",
    "logs:pm2": "pm2 logs",
    "monit:pm2": "pm2 monit"
  }
}`}
          language="json"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Cluster Mode Benefits
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Load Balancing</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Distributes requests across all CPU cores
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Zero Downtime Reload</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Graceful restarts without dropping connections
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Auto Restart</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically restarts crashed processes
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Memory Management</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Restarts workers exceeding memory limits
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
